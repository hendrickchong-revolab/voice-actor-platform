import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isUserAssignedToProject } from "@/lib/projectAccess";
import { getRecordingsQueue } from "@/lib/queues";

const retrySchema = z.object({
  scriptId: z.string().min(1),
  audioS3Uri: z.string().min(1),
  durationSec: z.number().optional(),
  audioSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const json = await req.json();
  const { scriptId, audioS3Uri, durationSec, audioSha256 } = retrySchema.parse(json);

  const script = await db.scriptLine.findUnique({ where: { id: scriptId } });
  if (!script) return NextResponse.json({ error: "SCRIPT_NOT_FOUND" }, { status: 404 });

  const allowed = await isUserAssignedToProject({
    userId: session.user.id,
    projectId: script.projectId,
    role: session.user.role,
  });
  if (!allowed) {
    return NextResponse.json({ error: "PROJECT_NOT_ASSIGNED" }, { status: 403 });
  }

  const rejectedExists = await db.recording.findFirst({
    where: {
      scriptId,
      userId: session.user.id,
      status: "REJECTED",
    },
    select: { id: true },
  });
  if (!rejectedExists) {
    return NextResponse.json({ error: "NO_REJECTED_RECORDING_FOR_SCRIPT" }, { status: 409 });
  }

  const existingInProgress = await db.recording.findFirst({
    where: {
      scriptId,
      userId: session.user.id,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    select: { id: true },
  });
  if (existingInProgress) {
    return NextResponse.json({ error: "ALREADY_SUBMITTED" }, { status: 409 });
  }

  const rec = await db.recording.create({
    data: {
      userId: session.user.id,
      scriptId,
      audioUrl: audioS3Uri,
      audioSha256: audioSha256 ? audioSha256.toLowerCase() : null,
      durationSec,
      status: "PENDING",
    },
  });

  await db.scriptLine.update({
    where: { id: scriptId },
    data: { status: "COMPLETED", lockedByUserId: null, lockedAt: null },
  });

  await getRecordingsQueue().add("processRecording", { recordingId: rec.id }, { jobId: rec.id });

  return NextResponse.json({ id: rec.id });
}
