import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isUserAssignedToProject } from "@/lib/projectAccess";
import { buildS3Uri, presignPut } from "@/lib/s3";

const bodySchema = z.object({
  scriptId: z.string().min(1),
  contentType: z.string().min(1),
  extension: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const json = await req.json();
  const { scriptId, contentType, extension, sha256 } = bodySchema.parse(json);

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
  const uploadUrl = await presignPut({
    bucket,
    key,
    contentType,
    expiresInSeconds: 120,
  });

  return NextResponse.json({
    uploadUrl,
    audioS3Uri: buildS3Uri(bucket, key),
  });
}
