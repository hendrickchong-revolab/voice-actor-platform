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
  if (!got.Body) throw new Error("SOURCE_OBJECT_EMPTY");

  await destS3.send(
    new PutObjectCommand({
      Bucket: destBucket,
      Key: destKey,
      Body: got.Body,
      ContentType: contentType,
    }),
  );

  return { bucket: destBucket, key: destKey };
}
