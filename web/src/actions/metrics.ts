"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/session";

export type AgentMetrics = {
  userId: string;
  email: string;
  name: string | null;
  totalCount: number;
  totalDurationSec: number;
  autoPassedDurationSec: number;
};

function toDayStartUtc(dateStr: string) {
  // Expects YYYY-MM-DD.
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function addDaysUtc(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function meanExprSql() {
  // Inline the arithmetic so Postgres treats it as numeric, not a bound text parameter.
  return Prisma.sql`COALESCE("meanScore", ("nisqaNoiPred" + "nisqaDisPred" + "nisqaColPred" + "nisqaLoudPred") / 4.0)`;
}

async function sumAutoPassedDurationForUser(userId: string, createdAt?: { gte: Date; lt: Date }) {
  const meanExpr = meanExprSql();
  const targetMosExpr = Prisma.sql`COALESCE(p."targetMos", 0)`;
  const dateClause = createdAt?.gte && createdAt?.lt
    ? Prisma.sql`AND r."createdAt" >= ${createdAt.gte} AND r."createdAt" < ${createdAt.lt}`
    : Prisma.sql``;

  const rows = await db.$queryRaw<{ total: number | null }[]>`
    SELECT COALESCE(SUM(r."durationSec"), 0) AS total
    FROM "Recording" r
    JOIN "ScriptLine" s ON s.id = r."scriptId"
    JOIN "Project" p ON p.id = s."projectId"
    WHERE r."userId" = ${userId}
      AND r.status <> 'REJECTED'
      ${dateClause}
      AND r."mosScore" IS NOT NULL
      AND ${meanExpr} IS NOT NULL
        AND r."mosScore" >= ${targetMosExpr}
      AND ${meanExpr} >= p."nisqaMinScore"
  `;

  return rows[0]?.total ?? 0;
}

async function autoPassedDurationsByUser(createdAt?: { gte: Date; lt: Date }) {
  const meanExpr = meanExprSql();
  const targetMosExpr = Prisma.sql`COALESCE(p."targetMos", 0)`;
  const dateClause = createdAt?.gte && createdAt?.lt
    ? Prisma.sql`AND r."createdAt" >= ${createdAt.gte} AND r."createdAt" < ${createdAt.lt}`
    : Prisma.sql``;
  const rows = await db.$queryRaw<{ userId: string; total: number | null }[]>`
    SELECT r."userId", COALESCE(SUM(r."durationSec"), 0) AS total
    FROM "Recording" r
    JOIN "ScriptLine" s ON s.id = r."scriptId"
    JOIN "Project" p ON p.id = s."projectId"
    WHERE r.status <> 'REJECTED'
      ${dateClause}
      AND r."mosScore" IS NOT NULL
      AND ${meanExpr} IS NOT NULL
      AND r."mosScore" >= ${targetMosExpr}
      AND ${meanExpr} >= p."nisqaMinScore"
    GROUP BY r."userId"
  `;

  return new Map(rows.map((r) => [r.userId, r.total ?? 0]));
}

function buildCreatedAtRange(input?: { from?: string; to?: string }) {
  if (!input?.from || !input?.to) return undefined;
  const from = toDayStartUtc(input.from);
  const toExclusive = addDaysUtc(toDayStartUtc(input.to), 1);
  if (Number.isNaN(from.getTime()) || Number.isNaN(toExclusive.getTime())) return undefined;
  return { gte: from, lt: toExclusive };
}

export async function getMyAgentMetrics(range?: { from?: string; to?: string }) {
  const session = await requireSession();
  const createdAt = buildCreatedAtRange(range);

  const totalAgg = await db.recording.aggregate({
    where: {
      userId: session.user.id,
      status: { not: "REJECTED" },
      ...(createdAt ? { createdAt } : {}),
    },
    _count: { _all: true },
    _sum: { durationSec: true },
  });

  return {
    totalCount: totalAgg._count._all,
    totalDurationSec: totalAgg._sum.durationSec ?? 0,
    autoPassedDurationSec: await sumAutoPassedDurationForUser(session.user.id, createdAt),
  };
}

export async function getAllAgentMetrics(range?: { from?: string; to?: string }): Promise<AgentMetrics[]> {
  await requireRole(["MANAGER", "ADMIN"]);
  const createdAt = buildCreatedAtRange(range);

  const agents = await db.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  const totals = await db.recording.groupBy({
    by: ["userId"],
    where: { status: { not: "REJECTED" }, ...(createdAt ? { createdAt } : {}) },
    _count: { _all: true },
    _sum: { durationSec: true },
  });

  const totalsByUser = new Map(
    totals.map((t) => [
      t.userId,
      {
        count: t._count._all,
        duration: t._sum.durationSec ?? 0,
      },
    ]),
  );

  const autoByUser = await autoPassedDurationsByUser(createdAt);

  return agents.map((a) => {
    const t = totalsByUser.get(a.id) ?? { count: 0, duration: 0 };
    const autoDur = autoByUser.get(a.id) ?? 0;
    return {
      userId: a.id,
      email: a.email,
      name: a.name,
      totalCount: t.count,
      totalDurationSec: t.duration,
      autoPassedDurationSec: autoDur,
    };
  });
}
