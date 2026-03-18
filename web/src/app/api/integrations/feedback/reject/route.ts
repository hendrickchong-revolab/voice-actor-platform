import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { createUserNotification } from "@/lib/notifications";
import { countPendingRejectedTasksForUser } from "@/lib/rejectedTasks";

export const runtime = "nodejs";

const bodySchema = z.object({
  recordingId: z.string().min(1),
  reason: z.string().min(1).max(500).optional(),
  source: z.string().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  const secret = process.env.FEEDBACK_PIPELINE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "MISSING_FEEDBACK_PIPELINE_SECRET" }, { status: 500 });
  }

  const auth = req.headers.get("x-feedback-secret") ?? "";
  if (auth !== secret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const json = await req.json();
  const { recordingId, reason, source } = bodySchema.parse(json);

  const rec = await db.recording.findUnique({
    where: { id: recordingId },
    select: { id: true, userId: true, scriptId: true, status: true },
  });

  if (!rec) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await db.recording.update({
    where: { id: recordingId },
    data: {
      status: "REJECTED",
      reviewNote: reason ?? "Rejected by external feedback pipeline",
    },
  });

  const pendingRejectedCount = await countPendingRejectedTasksForUser({ userId: rec.userId });

  await createUserNotification({
    userId: rec.userId,
    type: "recording.rejected",
    title: "A task has been rejected.",
    message: `A task has been rejected.\nThere are pending ${pendingRejectedCount} rejected tasks to review.\nClick to goto view rejected tasks`,
    payload: {
      recordingId,
      scriptId: rec.scriptId,
      source: source ?? "external-feedback",
      reason: reason ?? null,
      href: "/agent/rejected-tasks",
      pendingRejectedCount,
    },
  });

  return NextResponse.json({ ok: true });
}
