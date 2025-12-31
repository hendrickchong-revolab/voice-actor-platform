import { Worker } from "bullmq";

import { db } from "@/lib/db";
import { redisConnection } from "@/lib/redis";
import { recordingsQueue } from "@/lib/queues";

type JobData = {
  recordingId: string;
};

async function sweepUnscoredOnce() {
  const batchSize = Number.parseInt(process.env.WORKER_SWEEP_BATCH ?? "50", 10) || 50;

  const candidates = await db.recording.findMany({
    where: {
      autoScoredAt: null,
      // Only sweep recordings that haven't been processed yet.
      // FLAGGED should be reviewed by a manager (and may represent a hard failure).
      status: "PENDING",
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(500, batchSize)),
  });

  for (const c of candidates) {
    try {
      await recordingsQueue.add("processRecording", { recordingId: c.id }, { jobId: c.id });
    } catch {
      // Ignore duplicate jobId (already queued / in-flight).
    }
  }

  if (candidates.length > 0) {
    console.log(`sweeper enqueued ${candidates.length} unscored recordings`);
  }
}

const worker = new Worker<JobData>(
  "recordings",
  async (job) => {
    const { recordingId } = job.data;

    const pyworkerUrl = process.env.PYWORKER_URL;
    if (!pyworkerUrl) {
      throw new Error("Missing PYWORKER_URL");
    }

    const rec = await db.recording.findUnique({ where: { id: recordingId } });
    if (!rec) return;

    if (rec.status === "APPROVED" || rec.status === "REJECTED") return;

    await db.recording.update({
      where: { id: recordingId },
      data: { status: "PROCESSING" },
    });

    const res = await fetch(`${pyworkerUrl.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recordingId }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`pyworker http ${res.status} for ${recordingId}: ${text}`);
      const totalAttempts = job.opts.attempts ?? 1;
      const nextAttempt = job.attemptsMade + 1;
      const isLast = nextAttempt >= totalAttempts;

      if (isLast) {
        await db.recording.update({
          where: { id: recordingId },
          data: {
            status: "FLAGGED",
            reviewNote: `Pyworker failed (final attempt): ${text}`,
          },
        });
        return;
      }

      // Retryable failure: set back to PENDING so it can be reprocessed.
      await db.recording.update({
        where: { id: recordingId },
        data: {
          status: "PENDING",
          reviewNote: `Pyworker failed (attempt ${nextAttempt}/${totalAttempts}): ${text}`,
        },
      });
      throw new Error(`PYWORKER_FAILED_${res.status}`);
    }

    // Best-effort visibility: log response summary.
    try {
      const json = (await res.json()) as { status?: string; note?: string };
      if (json?.status) console.log(`pyworker ok ${recordingId}: ${json.status}`);
      if (json?.note) console.log(`pyworker note ${recordingId}: ${json.note}`);
    } catch {
      // ignore
    }

    // Verify the worker actually persisted a score marker.
    const post = await db.recording.findUnique({
      where: { id: recordingId },
      select: { autoScoredAt: true },
    });
    if (!post?.autoScoredAt) {
      await db.recording.update({
        where: { id: recordingId },
        data: {
          status: "PENDING",
          reviewNote: "Pyworker returned 200 but did not persist autoScoredAt; retrying.",
        },
      });
      throw new Error("PYWORKER_NO_PERSIST");
    }
  },
  {
    connection: redisConnection(),
    concurrency: 1,
  },
);

// Reliability: periodically sweep for unscored recordings so background scoring
// continues even after DB resets / worker restarts / missed jobs.
const sweepEverySec = Number.parseInt(process.env.WORKER_SWEEP_INTERVAL_SEC ?? "60", 10) || 60;
setInterval(() => {
  void sweepUnscoredOnce();
}, Math.max(10, sweepEverySec) * 1000);
void sweepUnscoredOnce();

worker.on("completed", (job) => {
  console.log(`completed job ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`failed job ${job?.id}:`, err);
});

console.log("Recordings worker started.");
