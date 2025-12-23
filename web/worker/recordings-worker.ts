import { Worker } from "bullmq";

import { db } from "@/lib/db";
import { redisConnection } from "@/lib/redis";

type JobData = {
  recordingId: string;
};

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
      await db.recording.update({
        where: { id: recordingId },
        data: {
          status: "FLAGGED",
          reviewNote: `Pyworker failed: ${text}`,
        },
      });
    }
  },
  {
    connection: redisConnection(),
    concurrency: 1,
  },
);

worker.on("completed", (job) => {
  console.log(`completed job ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`failed job ${job?.id}:`, err);
});

console.log("Recordings worker started.");
