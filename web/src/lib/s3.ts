import { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function shouldForcePathStyle(endpoint?: string) {
  if (!endpoint) return false;
  const e = endpoint.toLowerCase();
  // AWS S3 virtual-hosted style is preferred; most S3-compatible endpoints expect path-style.
  if (e.includes("amazonaws.com")) return false;
  return true;
}

export function s3Client() {
  const region = process.env.S3_REGION;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing S3 env vars");
  }

  return new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: shouldForcePathStyle(endpoint),
  });
}

export async function ensureBucketExists(bucket: string) {
  const s3 = s3Client();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch {
      // On AWS or restricted environments, auto-creating buckets may fail.
      // If creation fails, let subsequent operations surface a clearer error.
    }
  }
}

export async function presignPut({
  bucket,
  key,
  contentType,
  expiresInSeconds = 60,
}: {
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const s3 = s3Client();
  await ensureBucketExists(bucket);

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

export async function presignGet({
  bucket,
  key,
  expiresInSeconds = 300,
}: {
  bucket: string;
  key: string;
  expiresInSeconds?: number;
}) {
  const s3 = s3Client();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

export function buildS3Uri(bucket: string, key: string) {
  return `s3://${bucket}/${key}`;
}

export function parseS3Uri(uri: string): { bucket: string; key: string } {
  if (!uri.startsWith("s3://")) {
    throw new Error("Invalid audioUrl (expected s3://bucket/key)");
  }
  const rest = uri.slice("s3://".length);
  const slash = rest.indexOf("/");
  if (slash < 0) throw new Error("Invalid audioUrl");
  return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}
