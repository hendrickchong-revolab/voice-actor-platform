"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/session";
import { reevaluateNisqaThresholds } from "@/lib/qc";

const createRecordingSchema = z.object({
  scriptId: z.string().min(1),
  audioS3Uri: z.string().min(1),
  durationSec: z.coerce.number().optional(),
});

export async function createRecording(input: unknown) {
  const session = await requireSession();
  const { scriptId, audioS3Uri, durationSec } = createRecordingSchema.parse(input);

  const script = await db.scriptLine.findUnique({ where: { id: scriptId } });
  if (!script) throw new Error("SCRIPT_NOT_FOUND");
  if (script.status !== "LOCKED" || script.lockedByUserId !== session.user.id) {
    throw new Error("SCRIPT_NOT_LOCKED_BY_USER");
  }

  const existing = await db.recording.findFirst({
    where: {
      scriptId,
      userId: session.user.id,
      status: { in: ["PENDING", "PROCESSING", "APPROVED"] },
    },
    select: { id: true },
  });
  if (existing) throw new Error("ALREADY_SUBMITTED");

  const rec = await db.recording.create({
    data: {
      userId: session.user.id,
      scriptId,
      audioUrl: audioS3Uri,
      durationSec,
      status: "PENDING",
    },
  });

  // Mark script completed so it won't be re-issued.
  await db.scriptLine.update({
    where: { id: scriptId },
    data: { status: "COMPLETED" },
  });

  return rec;
}

export async function listPendingForManager() {
  await requireRole(["MANAGER", "ADMIN"]);
  return db.recording.findMany({
    where: { status: { in: ["PENDING", "FLAGGED"] } },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      user: { select: { email: true, name: true } },
      script: { select: { text: true, context: true, projectId: true } },
    },
  });
}

export async function listRecordingsLog({ take = 200 }: { take?: number } = {}) {
  await requireRole(["MANAGER", "ADMIN"]);
  // Backwards-compatible path: if callers still pass `take`, behave the same.
  return db.recording.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { email: true, name: true } },
      script: {
        select: {
          text: true,
          context: true,
          project: { select: { id: true, title: true, targetMos: true } },
        },
      },
    },
  });
}

export async function getRecordingsLogPage({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}) {
  await requireRole(["MANAGER", "ADMIN"]);

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10;

  const skip = (safePage - 1) * safePageSize;
  const [total, items] = await Promise.all([
    db.recording.count(),
    db.recording.findMany({
      orderBy: { createdAt: "desc" },
      take: safePageSize,
      skip,
      include: {
        user: { select: { email: true, name: true } },
        script: {
          select: {
            text: true,
            context: true,
            project: { select: { id: true, title: true, targetMos: true } },
          },
        },
      },
    }),
  ]);

  return { total, items, page: safePage, pageSize: safePageSize };
}

const reviewSchema = z.object({
  recordingId: z.string().min(1),
  note: z.string().optional(),
});

export async function approveRecording(input: unknown) {
  const session = await requireRole(["MANAGER", "ADMIN"]);
  const { recordingId, note } = reviewSchema.parse(input);

  const updated = await db.recording.update({
    where: { id: recordingId },
    data: {
      status: "APPROVED",
      reviewedBy: session.user.id,
      reviewNote: note ?? null,
    },
  });

  revalidatePath("/manager/review");
  revalidatePath("/manager/recordings");
  return updated;
}

export async function rejectRecording(input: unknown) {
  const session = await requireRole(["MANAGER", "ADMIN"]);
  const { recordingId, note } = reviewSchema.parse(input);

  const updated = await db.recording.update({
    where: { id: recordingId },
    data: {
      status: "REJECTED",
      reviewedBy: session.user.id,
      reviewNote: note ?? null,
    },
  });

  // If rejected, allow the line to be re-recorded later.
  await db.scriptLine.update({
    where: { id: updated.scriptId },
    data: {
      status: "AVAILABLE",
      lockedByUserId: null,
      lockedAt: null,
    },
  });

  revalidatePath("/manager/review");
  revalidatePath("/manager/recordings");

  return updated;
}

const reevaluateSchema = z.object({
  minScore: z.coerce.number().min(0).max(5).optional(),
  projectId: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(5000).optional(),
});

export async function reevaluateNisqaAsAdmin(input: unknown) {
  await requireRole(["ADMIN"]);
  const parsed = reevaluateSchema.parse(input);
  const result = await reevaluateNisqaThresholds({
    minScoreOverride: parsed.minScore,
    projectId: parsed.projectId,
    take: parsed.take,
  });
  revalidatePath("/manager/review");
  revalidatePath("/manager/recordings");
  return result;
}
