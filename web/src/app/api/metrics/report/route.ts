import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function parseDateParam(value: string | null) {
  if (!value) return null;
  // YYYY-MM-DD
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function addDaysUtc(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDayUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKeyUtc(date: Date) {
  const iso = date.toISOString();
  return iso.slice(0, 7);
}

function startOfWeekUtc(date: Date) {
  // Monday as start; in UTC.
  const day = date.getUTCDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // Mon=0
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return addDaysUtc(start, -diff);
}

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[\n\r",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type Interval = "day" | "week" | "month";
type Scope = "mine" | "all";

function parseInterval(value: string | null): Interval {
  if (value === "week" || value === "month" || value === "day") return value;
  return "day";
}

function parseScope(value: string | null): Scope {
  if (value === "all" || value === "mine") return value;
  return "mine";
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const allTime = searchParams.get("allTime") === "1";
  const interval = parseInterval(searchParams.get("interval"));
  const scope = parseScope(searchParams.get("scope"));

  const from = allTime ? null : parseDateParam(fromStr);
  const to = allTime ? null : parseDateParam(toStr);
  if (!allTime && (!from || !to)) {
    return new NextResponse("Missing or invalid from/to (YYYY-MM-DD)", { status: 400 });
  }

  const toExclusive = to ? addDaysUtc(to, 1) : null;

  const isManagerLike = session.user.role === "MANAGER" || session.user.role === "ADMIN";
  const isAdmin = session.user.role === "ADMIN";

  if (scope === "all" && !isManagerLike) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const whereUserId = scope === "all" ? undefined : session.user.id;

  // Managers should be able to report across agents; keep it limited to agents for now.
  const userFilter =
    scope === "all"
      ? {
          user: {
            role: "AGENT" as const,
          },
        }
      : undefined;

  const rows = await db.recording.findMany({
    where: {
      status: { not: "REJECTED" },
      ...(from && toExclusive ? { createdAt: { gte: from, lt: toExclusive } } : {}),
      ...(whereUserId ? { userId: whereUserId } : {}),
      ...(userFilter ?? {}),
    },
    select: {
      userId: true,
      durationSec: true,
      createdAt: true,
      mosScore: true,
      meanScore: true,
      nisqaNoiPred: true,
      nisqaDisPred: true,
      nisqaColPred: true,
      nisqaLoudPred: true,
      user: { select: { email: true } },
      script: { select: { project: { select: { targetMos: true, nisqaMinScore: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Bucket key per interval.
  function bucketKey(date: Date) {
    if (interval === "month") return monthKeyUtc(date);
    if (interval === "week") return formatDayUtc(startOfWeekUtc(date));
    return formatDayUtc(date);
  }

  type Agg = {
    userId: string;
    email: string;
    bucket: string;
    taskCount: number;
    durationSec: number;
    autoPassedDurationSec: number;
  };

  const map = new Map<string, Agg>();
  for (const r of rows) {
    const bucket = bucketKey(r.createdAt);
    const key = `${r.userId}__${bucket}`;
    const existing = map.get(key);
    const duration = r.durationSec ?? 0;
    const mean =
      typeof r.meanScore === "number"
        ? r.meanScore
        : r.nisqaNoiPred != null && r.nisqaDisPred != null && r.nisqaColPred != null && r.nisqaLoudPred != null
          ? (r.nisqaNoiPred + r.nisqaDisPred + r.nisqaColPred + r.nisqaLoudPred) / 4
          : null;
    const targetMos = r.script.project.targetMos ?? 3.5;
    const minScore = r.script.project.nisqaMinScore ?? 3.5;
    const auto = r.mosScore != null && mean != null && r.mosScore >= targetMos && mean >= minScore ? duration : 0;

    if (!existing) {
      map.set(key, {
        userId: r.userId,
        email: r.user.email,
        bucket,
        taskCount: 1,
        durationSec: duration,
        autoPassedDurationSec: auto,
      });
    } else {
      existing.taskCount += 1;
      existing.durationSec += duration;
      existing.autoPassedDurationSec += auto;
    }
  }

  // NOTE: Admin can still request scope=all; managers too.
  // If you later want to let admins include managers/admins, remove userFilter.
  void isAdmin;

  const header = [
    "bucket",
    "user_email",
    "task_count",
    "duration_sec",
    "auto_passed_duration_sec",
  ];

  const out = [header.join(",")];
  for (const a of Array.from(map.values()).sort((x, y) => {
    if (x.bucket !== y.bucket) return x.bucket.localeCompare(y.bucket);
    return x.email.localeCompare(y.email);
  })) {
    out.push(
      [
        a.bucket,
        a.email,
        a.taskCount,
        a.durationSec.toFixed(2),
        a.autoPassedDurationSec.toFixed(2),
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = out.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${allTime ? `metrics_${scope}_${interval}_all_time.csv` : `metrics_${scope}_${interval}_${fromStr}_to_${toStr}.csv`}`,
    },
  });
}
