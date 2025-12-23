import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseS3Uri, presignGet } from "@/lib/s3";

const querySchema = z.object({
  recordingId: z.string().min(1),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const recordingId = searchParams.get("recordingId") ?? "";
  const { recordingId: id } = querySchema.parse({ recordingId });

  const rec = await db.recording.findUnique({
    where: { id },
    include: { script: true },
  });

  if (!rec) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Managers can listen to anything; agents can only listen to their own recordings.
  const role = session.user.role;
  if (role === "AGENT" && rec.userId !== session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { bucket, key } = parseS3Uri(rec.audioUrl);
  const url = await presignGet({ bucket, key, expiresInSeconds: 300 });

  return NextResponse.redirect(url);
}
