ALTER TABLE "ManualReviewSession"
ADD COLUMN "projectId" TEXT;

UPDATE "ManualReviewSession" s
SET "projectId" = sub."projectId"
FROM (
  SELECT i."sessionId", MIN(sc."projectId") AS "projectId"
  FROM "ManualReviewSessionItem" i
  JOIN "ScriptLine" sc ON sc."id" = i."scriptId"
  GROUP BY i."sessionId"
) sub
WHERE sub."sessionId" = s."id";

DELETE FROM "ManualReviewSession"
WHERE "projectId" IS NULL;

ALTER TABLE "ManualReviewSession"
ALTER COLUMN "projectId" SET NOT NULL;

CREATE INDEX "ManualReviewSession_projectId_createdAt_idx" ON "ManualReviewSession"("projectId", "createdAt");

ALTER TABLE "ManualReviewSession"
ADD CONSTRAINT "ManualReviewSession_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
