CREATE TABLE "ManualReviewSession" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "sampleSize" INTEGER NOT NULL,
  "totalItems" INTEGER NOT NULL,
  "reviewedItems" INTEGER NOT NULL DEFAULT 0,
  "approvedItems" INTEGER NOT NULL DEFAULT 0,
  "rejectedItems" INTEGER NOT NULL DEFAULT 0,
  "scorePercent" DOUBLE PRECISION,
  "approveRatio" DOUBLE PRECISION,
  "rejectRatio" DOUBLE PRECISION,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualReviewSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManualReviewSessionItem" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "recordingId" TEXT NOT NULL,
  "scriptId" TEXT NOT NULL,
  "decision" TEXT,
  "note" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualReviewSessionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualReviewSessionItem_sessionId_recordingId_key" ON "ManualReviewSessionItem"("sessionId", "recordingId");

CREATE INDEX "ManualReviewSession_managerId_createdAt_idx" ON "ManualReviewSession"("managerId", "createdAt");
CREATE INDEX "ManualReviewSession_targetUserId_createdAt_idx" ON "ManualReviewSession"("targetUserId", "createdAt");
CREATE INDEX "ManualReviewSession_completedAt_idx" ON "ManualReviewSession"("completedAt");
CREATE INDEX "ManualReviewSessionItem_sessionId_createdAt_idx" ON "ManualReviewSessionItem"("sessionId", "createdAt");
CREATE INDEX "ManualReviewSessionItem_recordingId_idx" ON "ManualReviewSessionItem"("recordingId");
CREATE INDEX "ManualReviewSessionItem_scriptId_idx" ON "ManualReviewSessionItem"("scriptId");

ALTER TABLE "ManualReviewSession"
ADD CONSTRAINT "ManualReviewSession_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManualReviewSession"
ADD CONSTRAINT "ManualReviewSession_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManualReviewSessionItem"
ADD CONSTRAINT "ManualReviewSessionItem_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "ManualReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManualReviewSessionItem"
ADD CONSTRAINT "ManualReviewSessionItem_recordingId_fkey"
FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManualReviewSessionItem"
ADD CONSTRAINT "ManualReviewSessionItem_scriptId_fkey"
FOREIGN KEY ("scriptId") REFERENCES "ScriptLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
