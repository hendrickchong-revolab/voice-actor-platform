import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { reevaluateNisqaThresholds } from "@/lib/qc";

const bodySchema = z.object({
  minScore: z.coerce.number().min(0).max(5).optional(),
  projectId: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(5000).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.parse(json ?? {});

  const result = await reevaluateNisqaThresholds({
    minScoreOverride: parsed.minScore,
    projectId: parsed.projectId,
    take: parsed.take,
  });

  return NextResponse.json({ ok: true, ...result });
}
