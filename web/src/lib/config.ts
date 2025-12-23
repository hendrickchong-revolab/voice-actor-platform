export const config = {
  recordingsLog: {
    defaultPageSize: Number.parseInt(process.env.RECORDINGS_LOG_PAGE_SIZE ?? "10", 10) || 10,
    maxPageSize: Number.parseInt(process.env.RECORDINGS_LOG_MAX_PAGE_SIZE ?? "50", 10) || 50,
  },
  exportS3: {
    // If EXPORT_S3_* is not provided, fall back to the primary S3_* settings.
    // This makes the "export" feature work out-of-the-box in single-bucket setups.
    bucket: process.env.EXPORT_S3_BUCKET ?? process.env.S3_BUCKET,
    prefix: process.env.EXPORT_S3_PREFIX ?? "exports",
    region: process.env.EXPORT_S3_REGION ?? process.env.S3_REGION,
    endpoint: process.env.EXPORT_S3_ENDPOINT ?? process.env.S3_ENDPOINT,
    accessKeyId: process.env.EXPORT_S3_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.EXPORT_S3_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: (() => {
      const raw = process.env.EXPORT_S3_FORCE_PATH_STYLE;
      if (raw !== undefined) return raw !== "false";

      const endpoint = process.env.EXPORT_S3_ENDPOINT ?? process.env.S3_ENDPOINT;
      // If no custom endpoint is set, we assume AWS defaults (virtual-hosted style).
      if (!endpoint) return false;
      // AWS S3 endpoints generally prefer virtual-hosted style.
      if (/amazonaws\.com/i.test(endpoint)) return false;
      // MinIO / many S3-compatible endpoints typically require path-style.
      return true;
    })(),
  },
} as const;
