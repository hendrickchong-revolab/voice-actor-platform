import type { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isUserAssignedToProject } from "@/lib/projectAccess";

export type NextRejectedTaskResult =
  | {
      status: "task";
      item: {
        script: {
          id: string;
          text: string;
          context: string | null;
          details?: Record<string, string | number | boolean | null | undefined> | null;
        };
        rejectedRecordingId: string;
      };
    }
  | { status: "done" }
  | { status: "none_available" };

function normalizeDetails(details: unknown): Record<string, string | number | boolean | null | undefined> | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const out: Record<string, string | number | boolean | null | undefined> = {};
  for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v == null) {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

export async function getRejectedTaskCountsByProject({
  userId,
}: {
  userId: string;
}) {
  const rows = await db.recording.groupBy({
    by: ["scriptId"],
    where: { userId, status: "REJECTED" },
  });

  if (rows.length === 0) return new Map<string, number>();

  const scripts = await db.scriptLine.findMany({
    where: { id: { in: rows.map((r) => r.scriptId) } },
    select: { id: true, projectId: true },
  });

  const scriptToProject = new Map(scripts.map((s) => [s.id, s.projectId]));
  const counts = new Map<string, number>();

  for (const row of rows) {
    const projectId = scriptToProject.get(row.scriptId);
    if (!projectId) continue;
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
  }

  return counts;
}

export async function countPendingRejectedTasksForUser({
  userId,
}: {
  userId: string;
}) {
  const rows = await db.$queryRaw<Array<{ count: number }>>(
    Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT DISTINCT ON (r."scriptId") r."scriptId", r."status"
        FROM "Recording" r
        WHERE r."userId" = ${userId}
        ORDER BY r."scriptId", r."createdAt" DESC
      ) latest
      WHERE latest."status" = 'REJECTED'
    `,
  );

  return rows[0]?.count ?? 0;
}

export async function getNextRejectedTaskForAgent({
  projectId,
  userId,
  role,
}: {
  projectId: string;
  userId: string;
  role: UserRole;
}): Promise<NextRejectedTaskResult> {
  const allowed = await isUserAssignedToProject({ userId, projectId, role });
  if (!allowed) throw new Error("UNAUTHORIZED_PROJECT");

  const rejected = await db.recording.findMany({
    where: {
      userId,
      status: "REJECTED",
      script: { projectId },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, scriptId: true, createdAt: true },
    take: 200,
  });

  for (const rec of rejected) {
    const replacement = await db.recording.findFirst({
      where: {
        userId,
        scriptId: rec.scriptId,
        createdAt: { gt: rec.createdAt },
        status: { in: ["PENDING", "PROCESSING", "APPROVED"] },
      },
      select: { id: true },
    });

    if (replacement) continue;

    const script = (await db.scriptLine.findUnique(
      ({
        where: { id: rec.scriptId },
        select: { id: true, text: true, context: true, details: true },
      } as unknown) as Parameters<typeof db.scriptLine.findUnique>[0],
    )) as
      | {
          id: string;
          text: string;
          context: string | null;
          details?: unknown;
        }
      | null;

    if (!script) continue;

    return {
      status: "task",
      item: {
        script: {
          id: script.id,
          text: script.text,
          context: script.context,
          details: normalizeDetails(script.details),
        },
        rejectedRecordingId: rec.id,
      },
    };
  }

  return { status: "none_available" };
}
