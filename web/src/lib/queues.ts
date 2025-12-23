import { Queue } from "bullmq";

import { redisConnection } from "@/lib/redis";

export const recordingsQueue = new Queue("recordings", {
  connection: redisConnection(),
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});
