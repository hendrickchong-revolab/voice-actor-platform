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
  nisqaMinScore: z.coerce.number().min(0).max(5).optional(),
});

export async function createProject(input: unknown) {
  try {
    await requireRole(["MANAGER", "ADMIN"]);
    const data = createProjectSchema.parse(input);

    const created = await db.project.create({
      data: {
        title: data.title,
        description: data.description,
        language: data.language || null,
        nisqaMinScore: data.nisqaMinScore ?? 3.5,
      },
    });

    revalidatePath("/manager/projects");
    return created;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid input: ${error.issues.map((e) => e.message).join(", ")}`);
    }
    throw error;
  }
}

export async function getProjectsPage({
  page,
  pageSize = 10,
}: {
  page: number;
  pageSize?: number;
}) {
  await requireRole(["MANAGER", "ADMIN"]);
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
  const skip = (safePage - 1) * safePageSize;

  const [total, items] = await Promise.all([
    db.project.count({ where: { isActive: true } }),
    db.project.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: safePageSize,
      skip,
      select: {
        id: true,
        title: true,
        language: true,
        createdAt: true,
      },
    }),
  ]);

  return { total, items, page: safePage, pageSize: safePageSize };
}

const updateProjectGeneralSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  language: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t.length === 0 ? null : t;
    },
    z.string().min(1).nullable().optional(),
  ),
});

export async function updateProjectGeneral(input: unknown) {
  await requireRole(["MANAGER", "ADMIN"]);
  const data = updateProjectGeneralSchema.parse(input);
  const updated = await db.project.update({
    where: { id: data.projectId },
    data: {
      title: data.title,
      description: data.description,
      language: data.language ?? null,
    },
    select: { id: true },
  });
  revalidatePath("/manager/projects");
  revalidatePath(`/manager/projects/${data.projectId}`);
  revalidatePath("/agent/tasks");
  return updated;
}

const updateProjectAdvancedSchema = z.object({
  projectId: z.string().min(1),
  targetMos: z.coerce.number().min(0).max(5),
  nisqaMinScore: z.coerce.number().min(0).max(5),
});

export async function updateProjectAdvanced(input: unknown) {
  await requireRole(["MANAGER", "ADMIN"]);
  const data = updateProjectAdvancedSchema.parse(input);
  const updated = await db.project.update({
    where: { id: data.projectId },
    data: { targetMos: data.targetMos, nisqaMinScore: data.nisqaMinScore },
    select: { id: true },
  });
  revalidatePath("/manager/projects");
  revalidatePath(`/manager/projects/${data.projectId}`);
  return updated;
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
