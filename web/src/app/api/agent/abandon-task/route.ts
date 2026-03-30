import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  // Release any task this user has locked in this project back to AVAILABLE.
  await db.scriptLine.updateMany({
    where: {
      projectId: parsed.data.projectId,
      lockedByUserId: session.user.id,
      status: "LOCKED",
    },
    data: {
      status: "AVAILABLE",
      lockedByUserId: null,
      lockedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
