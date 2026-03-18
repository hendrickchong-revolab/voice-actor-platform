import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { createManualReviewSession } from "@/lib/manualReviewSessions";

const bodySchema = z.object({
  targetUserId: z.string().min(1),
  projectId: z.string().min(1),
  sampleSize: z.coerce.number().int().min(1).max(50),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const json = await req.json();
    const data = bodySchema.parse(json);
    const created = await createManualReviewSession({
      managerId: session.user.id,
      targetUserId: data.targetUserId,
      projectId: data.projectId,
      sampleSize: data.sampleSize,
    });

    return NextResponse.json({ sessionId: created.sessionId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "UNKNOWN";
    if (message === "NOT_ENOUGH_ELIGIBLE_RECORDINGS") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message === "TARGET_USER_REQUIRED" || message === "PROJECT_REQUIRED" || message === "INVALID_SAMPLE_SIZE") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
