import IORedis from "ioredis";

declare global {
  var __redis: IORedis | undefined;
}

export function redisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Missing REDIS_URL");

  if (!globalThis.__redis) {
    globalThis.__redis = new IORedis(url, {
      maxRetriesPerRequest: null,
    });
  }

  return globalThis.__redis;
}
