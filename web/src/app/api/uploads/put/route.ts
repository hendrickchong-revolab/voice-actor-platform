import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isUserAssignedToProject } from "@/lib/projectAccess";
import { buildS3Uri, ensureBucketExists, s3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const formSchema = z.object({
  scriptId: z.string().min(1),
  contentType: z.string().min(1),
  extension: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

function getString(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const form = await req.formData();

  const scriptId = getString(form, "scriptId");
  const contentType = getString(form, "contentType");
  const extension = getString(form, "extension");
  const sha256 = getString(form, "sha256");

  const parsed = formSchema.safeParse({ scriptId, contentType, extension, sha256 });
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "MISSING_FILE" }, { status: 400 });
  }

  const script = await db.scriptLine.findUnique({ where: { id: scriptId } });
  if (!script) {
    return NextResponse.json({ error: "SCRIPT_NOT_FOUND" }, { status: 404 });
  }

  if (script.status !== "LOCKED" || script.lockedByUserId !== session.user.id) {
    return NextResponse.json({ error: "SCRIPT_NOT_LOCKED_BY_USER" }, { status: 403 });
  }

  const allowed = await isUserAssignedToProject({
    userId: session.user.id,
    projectId: script.projectId,
    role: session.user.role,
  });
  if (!allowed) {
    return NextResponse.json({ error: "PROJECT_NOT_ASSIGNED" }, { status: 403 });
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: "MISSING_S3_BUCKET" }, { status: 500 });
  }

  const safeExt = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `recordings/${script.projectId}/${sha256.toLowerCase()}.${safeExt}`;

  const bytes = Buffer.from(await file.arrayBuffer());

  const s3 = s3Client();
  await ensureBucketExists(bucket);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );

  return NextResponse.json({
    audioS3Uri: buildS3Uri(bucket, key),
  });
}
