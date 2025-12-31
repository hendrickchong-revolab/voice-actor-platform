import { Queue } from "bullmq";

import { redisConnection } from "@/lib/redis";

declare global {
  var __recordingsQueue: Queue | undefined;
}

export function getRecordingsQueue() {
  // Avoid initializing Redis/BullMQ at module-eval time.
  // Next build evaluates route modules; eager init can crash builds when env vars are absent.
  if (!globalThis.__recordingsQueue) {
    globalThis.__recordingsQueue = new Queue("recordings", {
      connection: redisConnection(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }

  return globalThis.__recordingsQueue;
}
