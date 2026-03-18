import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { listReviewableProjectsForAgent } from "@/lib/manualReviewSessions";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = (searchParams.get("agentId") ?? "").trim();
  if (!agentId) {
    return NextResponse.json({ projects: [] });
  }

  try {
    const projects = await listReviewableProjectsForAgent(agentId);
    return NextResponse.json({ projects });
  } catch (e) {
    const message = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
