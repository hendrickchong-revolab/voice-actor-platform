import { db } from "@/lib/db";
import { isUserAssignedToProject } from "@/lib/projectAccess";
import type { Prisma, UserRole } from "@prisma/client";

type PromptDetailValue = string | number | boolean | null | undefined;

export type NextTaskResult =
  | {
      status: "task";
      script: {
        id: string;
        text: string;
        context: string | null;
        details?: Record<string, PromptDetailValue> | null;
      };
    }
  | { status: "done" }
  | { status: "none_available" };

function normalizePromptDetails(details: Prisma.JsonValue | null): Record<string, PromptDetailValue> | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;

  const out: Record<string, PromptDetailValue> = {};
  for (const [key, value] of Object.entries(details)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value == null
    ) {
      out[key] = value;
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

function toTaskScriptPayload(script: {
  id: string;
  text: string;
  context: string | null;
  details: Prisma.JsonValue | null;
}) {
  return {
    id: script.id,
    text: script.text,
    context: script.context,
    details: normalizePromptDetails(script.details),
  };
}

async function releaseExpiredLocks({ minutes = 30 }: { minutes?: number } = {}) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  await db.scriptLine.updateMany({
    where: {
      status: "LOCKED",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "AVAILABLE",
      lockedByUserId: null,
      lockedAt: null,
    },
  });
}

export async function getNextTaskForAgent({
  projectId,
  userId,
  role,
}: {
  projectId: string;
  userId: string;
  role: UserRole;
}): Promise<NextTaskResult> {
  const allowed = await isUserAssignedToProject({ userId, projectId, role });
  if (!allowed) {
    // API routes handle auth errors; callers can translate.
    throw new Error("UNAUTHORIZED_PROJECT");
  }

  await releaseExpiredLocks({ minutes: 30 });

  const existing = await db.scriptLine.findFirst({
    where: {
      projectId,
      lockedByUserId: userId,
      status: "LOCKED",
    },
    orderBy: { lockedAt: "asc" },
    select: { id: true, text: true, context: true, details: true },
  });

  if (existing) {
    return { status: "task", script: toTaskScriptPayload(existing) };
  }

  // Try to lock exactly one AVAILABLE script.
  const candidate = await db.scriptLine.findFirst({
    where: { projectId, status: "AVAILABLE" },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (candidate) {
    const now = new Date();
    const res = await db.scriptLine.updateMany({
      where: {
        id: candidate.id,
        status: "AVAILABLE",
        lockedByUserId: null,
      },
      data: {
        status: "LOCKED",
        lockedByUserId: userId,
        lockedAt: now,
      },
    });

    if (res.count > 0) {
      const locked = await db.scriptLine.findUnique({
        where: { id: candidate.id },
        select: { id: true, text: true, context: true, details: true },
      });
      if (locked) return { status: "task", script: toTaskScriptPayload(locked) };
    }
  }

  // Nothing lockable for this user. Decide if the project is fully exhausted.
  const remaining = await db.scriptLine.count({
    where: {
      projectId,
      status: { in: ["AVAILABLE", "LOCKED"] },
    },
  });

  if (remaining === 0) {
    return { status: "done" };
  }

  return { status: "none_available" };
}
