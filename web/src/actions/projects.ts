"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/session";

const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  language: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t.length === 0 ? undefined : t;
    },
    z.string().min(1).optional(),
  ),
});

export async function createProject(input: unknown) {
  await requireRole(["MANAGER", "ADMIN"]);
  const data = createProjectSchema.parse(input);

  const created = await db.project.create({
    data: {
      title: data.title,
      description: data.description,
      language: data.language || null,
    },
  });

  revalidatePath("/manager/projects");
  return created;
}

export async function listActiveProjects() {
  await requireRole(["MANAGER", "ADMIN"]);
  return db.project.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listProjectsForAgent() {
  const session = await requireSession();

  // Managers/Admins can see all active projects.
  if (session.user.role === "MANAGER" || session.user.role === "ADMIN") {
    return db.project.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // Agents only see projects they are assigned to.
  return db.project.findMany({
    where: {
      isActive: true,
      assignments: {
        some: {
          userId: session.user.id,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
