import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

import { config } from "@/lib/config";

function exportS3Client() {
  const { region, endpoint, accessKeyId, secretAccessKey, forcePathStyle } = config.exportS3;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing EXPORT_S3_* env vars");
  }

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });
}

async function ensureBucketExists(s3: S3Client, bucket: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) throw new Error("SOURCE_OBJECT_EMPTY");

  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);

  // Some runtimes expose Blob-like bodies.
  if (typeof (body as { arrayBuffer?: unknown }).arrayBuffer === "function") {
    const ab = await (body as Blob).arrayBuffer();
    return Buffer.from(ab);
  }

  // Web ReadableStream (Node 18+ can surface this shape).
  if (typeof (body as { getReader?: unknown }).getReader === "function") {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const chunks: Buffer[] = [];
    let done = false;
    while (!done) {
      const { done: readDone, value } = await reader.read();
      done = readDone;
      if (value) chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  // Node.js Readable stream.
  if (typeof (body as { on?: unknown }).on === "function") {
    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = body as NodeJS.ReadableStream;
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  throw new Error("UNSUPPORTED_SOURCE_BODY");
}

export async function uploadToExportBucket({
  sourceS3,
  sourceBucket,
  sourceKey,
  destKey,
  contentType,
}: {
  sourceS3: S3Client;
  sourceBucket: string;
  sourceKey: string;
  destKey: string;
  contentType?: string;
}) {
  const destBucket = config.exportS3.bucket;
  if (!destBucket) throw new Error("Missing export bucket (set EXPORT_S3_BUCKET or S3_BUCKET)");

  const destS3 = exportS3Client();
  await ensureBucketExists(destS3, destBucket);

  const got = await sourceS3.send(new GetObjectCommand({ Bucket: sourceBucket, Key: sourceKey }));
  const buf = await bodyToBuffer(got.Body);
  const resolvedContentType = contentType ?? got.ContentType ?? undefined;

  await destS3.send(
    new PutObjectCommand({
      Bucket: destBucket,
      Key: destKey,
      Body: buf,
      ContentLength: buf.length,
      ContentType: resolvedContentType,
    }),
  );

  return { bucket: destBucket, key: destKey };
}
