import type { UserRole } from "@prisma/client";

import { db } from "@/lib/db";

export async function isUserAssignedToProject(params: {
  userId: string;
  projectId: string;
  role?: UserRole;
}) {
  const { userId, projectId, role } = params;

  // Managers/Admins have global access.
  if (role === "MANAGER" || role === "ADMIN") return true;

  const assignment = await db.projectAssignment.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}
