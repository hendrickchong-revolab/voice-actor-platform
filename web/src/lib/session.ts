import { getServerSession } from "next-auth";
import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    redirect("/unauthorized");
  }
  return session;
}
