import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

export async function DELETE(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { userId } = paramsSchema.parse(await ctx.params);

  if (userId === session.user.id) {
    return new NextResponse("You can’t delete your own account.", { status: 400 });
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!target) return new NextResponse("Not found", { status: 404 });

  if (target.role === "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return new NextResponse("Cannot delete the last admin.", { status: 400 });
    }
  }

  await db.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}
