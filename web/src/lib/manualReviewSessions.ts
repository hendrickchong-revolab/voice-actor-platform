import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

type ReviewDecision = "APPROVED" | "REJECTED";

export type ReviewableAgent = {
  userId: string;
  email: string;
  name: string | null;
  eligibleCount: number;
};

export type ReviewableAgentProject = {
  projectId: string;
  projectTitle: string;
};

export type ManualReviewSessionSummary = {
  id: string;
  managerId: string;
  managerEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  projectId: string;
  projectTitle: string;
  sampleSize: number;
  totalItems: number;
  reviewedItems: number;
  approvedItems: number;
  rejectedItems: number;
  scorePercent: number | null;
  approveRatio: number | null;
  rejectRatio: number | null;
  completedAt: Date | null;
  createdAt: Date;
};

export type ManualReviewSessionItem = {
  id: string;
  recordingId: string;
  scriptId: string;
  decision: string | null;
  note: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  recordingStatus: string;
  scriptText: string;
  scriptContext: string | null;
};

export type ManualReviewSessionDetail = ManualReviewSessionSummary & {
  items: ManualReviewSessionItem[];
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function listReviewableAgents(): Promise<ReviewableAgent[]> {
  await requireRole(["MANAGER", "ADMIN"]);

  const rows = await db.$queryRaw<
    Array<{ userId: string; email: string; name: string | null; eligibleCount: number }>
  >(
    Prisma.sql`SELECT r."userId" AS "userId", u."email" AS "email", u."name" AS "name", COUNT(*)::int AS "eligibleCount"
               FROM "Recording" r
               JOIN "User" u ON u.id = r."userId"
               WHERE r."status" <> 'PROCESSING'
                 AND u."role" = 'AGENT'
               GROUP BY r."userId", u."email", u."name"
               ORDER BY COUNT(*) DESC, u."email" ASC`,
  );

  return rows;
}

export async function listReviewableProjectsForAgent(targetUserId: string): Promise<ReviewableAgentProject[]> {
  await requireRole(["MANAGER", "ADMIN"]);

  if (!targetUserId) return [];

  const rows = await db.$queryRaw<ReviewableAgentProject[]>(
    Prisma.sql`SELECT p."id" AS "projectId",
                      p."title" AS "projectTitle"
               FROM "Recording" r
               JOIN "ScriptLine" s ON s."id" = r."scriptId"
               JOIN "Project" p ON p."id" = s."projectId"
               WHERE r."userId" = ${targetUserId}
                 AND r."status" <> 'PROCESSING'
               GROUP BY p."id", p."title"
               ORDER BY p."title" ASC`,
  );

  return rows;
}

export async function createManualReviewSession(input: {
  managerId: string;
  targetUserId: string;
  projectId: string;
  sampleSize: number;
}) {
  await requireRole(["MANAGER", "ADMIN"]);

  if (!input.targetUserId) throw new Error("TARGET_USER_REQUIRED");
  if (!input.projectId) throw new Error("PROJECT_REQUIRED");

  const sampleSize = Math.max(1, Math.min(50, Math.floor(input.sampleSize || 0)));
  if (!sampleSize) throw new Error("INVALID_SAMPLE_SIZE");

  const pending = await db.$queryRaw<Array<{ recordingId: string; scriptId: string }>>(
    Prisma.sql`SELECT r."id" AS "recordingId", r."scriptId" AS "scriptId"
               FROM "Recording" r
               JOIN "ScriptLine" s ON s."id" = r."scriptId"
               WHERE r."userId" = ${input.targetUserId}
                 AND s."projectId" = ${input.projectId}
                 AND r."status" <> 'PROCESSING'
               ORDER BY RANDOM()
               LIMIT ${sampleSize}`,
  );

  if (pending.length < sampleSize) {
    throw new Error("NOT_ENOUGH_ELIGIBLE_RECORDINGS");
  }

  const sessionId = makeId("mrs");
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`INSERT INTO "ManualReviewSession"
                 ("id", "managerId", "targetUserId", "projectId", "sampleSize", "totalItems", "reviewedItems", "approvedItems", "rejectedItems", "createdAt", "updatedAt")
                 VALUES (${sessionId}, ${input.managerId}, ${input.targetUserId}, ${input.projectId}, ${sampleSize}, ${pending.length}, 0, 0, 0, ${now}, ${now})`,
    );

    for (const row of pending) {
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO "ManualReviewSessionItem"
                   ("id", "sessionId", "recordingId", "scriptId", "createdAt")
                   VALUES (${makeId("mrsi")}, ${sessionId}, ${row.recordingId}, ${row.scriptId}, ${now})`,
      );
    }
  });

  return { sessionId };
}

export async function listManualReviewSessions(limit = 20): Promise<ManualReviewSessionSummary[]> {
  await requireRole(["MANAGER", "ADMIN"]);

  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await db.$queryRaw<ManualReviewSessionSummary[]>(
    Prisma.sql`SELECT s."id",
                      s."managerId",
                      mu."email" AS "managerEmail",
                      s."targetUserId",
                      tu."email" AS "targetUserEmail",
                      s."projectId",
                      p."title" AS "projectTitle",
                      s."sampleSize",
                      s."totalItems",
                      s."reviewedItems",
                      s."approvedItems",
                      s."rejectedItems",
                      s."scorePercent",
                      s."approveRatio",
                      s."rejectRatio",
                      s."completedAt",
                      s."createdAt"
               FROM "ManualReviewSession" s
               JOIN "User" mu ON mu."id" = s."managerId"
               JOIN "User" tu ON tu."id" = s."targetUserId"
               JOIN "Project" p ON p."id" = s."projectId"
               ORDER BY s."createdAt" DESC
               LIMIT ${safeLimit}`,
  );

  return rows;
}

export async function getManualReviewSession(sessionId: string): Promise<ManualReviewSessionDetail | null> {
  await requireRole(["MANAGER", "ADMIN"]);

  const sessionRows = await db.$queryRaw<ManualReviewSessionSummary[]>(
    Prisma.sql`SELECT s."id",
                      s."managerId",
                      mu."email" AS "managerEmail",
                      s."targetUserId",
                      tu."email" AS "targetUserEmail",
                      s."projectId",
                      p."title" AS "projectTitle",
                      s."sampleSize",
                      s."totalItems",
                      s."reviewedItems",
                      s."approvedItems",
                      s."rejectedItems",
                      s."scorePercent",
                      s."approveRatio",
                      s."rejectRatio",
                      s."completedAt",
                      s."createdAt"
               FROM "ManualReviewSession" s
               JOIN "User" mu ON mu."id" = s."managerId"
               JOIN "User" tu ON tu."id" = s."targetUserId"
               JOIN "Project" p ON p."id" = s."projectId"
               WHERE s."id" = ${sessionId}
               LIMIT 1`,
  );

  const session = sessionRows[0];
  if (!session) return null;

  const items = await db.$queryRaw<ManualReviewSessionItem[]>(
    Prisma.sql`SELECT i."id",
                      i."recordingId",
                      i."scriptId",
                      i."decision",
                      i."note",
                      i."decidedAt",
                      i."createdAt",
                      r."status" AS "recordingStatus",
                      s."text" AS "scriptText",
                      s."context" AS "scriptContext"
               FROM "ManualReviewSessionItem" i
               JOIN "Recording" r ON r."id" = i."recordingId"
               JOIN "ScriptLine" s ON s."id" = i."scriptId"
               WHERE i."sessionId" = ${sessionId}
               ORDER BY i."createdAt" ASC`,
  );

  return { ...session, items };
}

export async function submitManualReviewDecision(input: {
  sessionId: string;
  itemId: string;
  decision: ReviewDecision;
  note?: string | null;
  actorUserId: string;
}) {
  await requireRole(["MANAGER", "ADMIN"]);

  const decision = input.decision;
  const note = input.note?.trim() ? input.note.trim() : null;

  const itemRows = await db.$queryRaw<
    Array<{
      itemId: string;
      sessionId: string;
      managerId: string;
      targetUserId: string;
      recordingId: string;
      scriptId: string;
      existingDecision: string | null;
      completedAt: Date | null;
    }>
  >(
    Prisma.sql`SELECT i."id" AS "itemId",
                      i."sessionId" AS "sessionId",
                      i."decision" AS "existingDecision",
                      s."managerId" AS "managerId",
                      s."targetUserId" AS "targetUserId",
                      s."completedAt" AS "completedAt",
                      i."recordingId" AS "recordingId",
                      i."scriptId" AS "scriptId"
               FROM "ManualReviewSessionItem" i
               JOIN "ManualReviewSession" s ON s."id" = i."sessionId"
               WHERE i."id" = ${input.itemId}
                 AND i."sessionId" = ${input.sessionId}
               LIMIT 1`,
  );

  const item = itemRows[0];
  if (!item) throw new Error("SESSION_ITEM_NOT_FOUND");
  if (item.managerId !== input.actorUserId) throw new Error("FORBIDDEN_SESSION_OWNER");
  if (item.completedAt) throw new Error("SESSION_ALREADY_COMPLETED");
  if (item.existingDecision) throw new Error("ITEM_ALREADY_REVIEWED");

  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`UPDATE "ManualReviewSessionItem"
                 SET "decision" = ${decision}, "note" = ${note}, "decidedAt" = ${now}
                 WHERE "id" = ${input.itemId}`,
    );

    const counts = await tx.$queryRaw<
      Array<{ totalItems: number; reviewedItems: number; approvedItems: number; rejectedItems: number }>
    >(
      Prisma.sql`SELECT COUNT(*)::int AS "totalItems",
                        COUNT(i."decision")::int AS "reviewedItems",
                        COUNT(*) FILTER (WHERE i."decision" = 'APPROVED')::int AS "approvedItems",
                        COUNT(*) FILTER (WHERE i."decision" = 'REJECTED')::int AS "rejectedItems"
                 FROM "ManualReviewSessionItem" i
                 WHERE i."sessionId" = ${input.sessionId}`,
    );

    const c = counts[0];
    const reviewed = c?.reviewedItems ?? 0;
    const total = c?.totalItems ?? 0;
    const approved = c?.approvedItems ?? 0;
    const rejected = c?.rejectedItems ?? 0;

    if (total > 0 && reviewed >= total) {
      const approveRatio = approved / total;
      const rejectRatio = rejected / total;
      const scorePercent = approveRatio * 100;

      await tx.$executeRaw(
        Prisma.sql`UPDATE "ManualReviewSession"
                   SET "reviewedItems" = ${reviewed},
                       "approvedItems" = ${approved},
                       "rejectedItems" = ${rejected},
                       "approveRatio" = ${approveRatio},
                       "rejectRatio" = ${rejectRatio},
                       "scorePercent" = ${scorePercent},
                       "completedAt" = ${now},
                       "updatedAt" = ${now}
                   WHERE "id" = ${input.sessionId}`,
      );
    } else {
      await tx.$executeRaw(
        Prisma.sql`UPDATE "ManualReviewSession"
                   SET "reviewedItems" = ${reviewed},
                       "approvedItems" = ${approved},
                       "rejectedItems" = ${rejected},
                       "updatedAt" = ${now}
                   WHERE "id" = ${input.sessionId}`,
      );
    }
  });
}
