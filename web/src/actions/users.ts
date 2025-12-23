"use server";

import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/session";

export async function listUsers() {
  const session = await requireSession();

  // Managers can only see agents/managers (not admins).
  const where =
    session.user.role === "ADMIN"
      ? undefined
      : {
          role: {
            in: ["AGENT", "MANAGER"] as UserRole[],
          },
        };

  return db.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["AGENT", "MANAGER", "ADMIN"]),
});

export async function updateUserRole(input: unknown) {
  const session = await requireRole(["ADMIN"]);
  const { userId, role } = updateRoleSchema.parse(input);

  // Safety: prevent self-demotion which could lock out admin controls.
  if (session.user.id === userId && role !== "ADMIN") {
    throw new Error("CANNOT_CHANGE_OWN_ROLE");
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error("USER_NOT_FOUND");

  const updated = await db.user.update({
    where: { id: userId },
    data: { role: role as UserRole },
    select: { id: true, role: true },
  });

  revalidatePath("/manager/users");
  return updated;
}

export async function listAgents() {
  await requireRole(["MANAGER", "ADMIN"]);
  return db.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "desc" },
  });
}

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dot, underscore, dash only.");

const createUserSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  username: usernameSchema,
  password: z.string().min(6),
  role: z.enum(["AGENT", "MANAGER", "ADMIN"]).optional(),
});

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

async function ensureEmailAndUsernameAvailable({
  email,
  username,
  excludeUserId,
}: {
  email?: string;
  username?: string;
  excludeUserId?: string;
}) {
  if (email) {
    const existingByEmail = await db.user.findUnique({ where: { email } });
    if (existingByEmail && existingByEmail.id !== excludeUserId) throw new Error("EMAIL_IN_USE");
  }
  if (username) {
    const existingByUsername = await db.user.findFirst({ where: { username } });
    if (existingByUsername && existingByUsername.id !== excludeUserId) throw new Error("USERNAME_IN_USE");
  }
}

// Public registration: always creates AGENT.
export async function registerUser(input: unknown) {
  const data = createUserSchema.parse(input);
  await ensureEmailAndUsernameAvailable({ email: data.email, username: data.username });

  const hashed = await bcrypt.hash(data.password, 12);
  const user = await db.user.create({
    data: {
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      name: fullName(data.firstName, data.lastName),
      password: hashed,
      role: "AGENT",
    },
    select: { id: true, email: true },
  });

  return user;
}

// Admin-only user creation (role can be set).
export async function createUserAsAdmin(input: unknown) {
  await requireRole(["ADMIN"]);
  const data = createUserSchema.parse(input);
  await ensureEmailAndUsernameAvailable({ email: data.email, username: data.username });

  const hashed = await bcrypt.hash(data.password, 12);
  const role: UserRole = (data.role ?? "AGENT") as UserRole;

  const user = await db.user.create({
    data: {
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      name: fullName(data.firstName, data.lastName),
      password: hashed,
      role,
    },
    select: { id: true, email: true, role: true, username: true },
  });

  revalidatePath("/manager/users");
  return user;
}

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  username: usernameSchema,
});

export async function updateMyProfile(input: unknown) {
  const session = await requireSession();
  const data = updateProfileSchema.parse(input);
  await ensureEmailAndUsernameAvailable({ username: data.username, excludeUserId: session.user.id });

  return db.user.update({
    where: { id: session.user.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      username: data.username,
      name: fullName(data.firstName, data.lastName),
    },
    select: { id: true, email: true, username: true, firstName: true, lastName: true },
  });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function changeMyPassword(input: unknown) {
  const session = await requireSession();
  const data = changePasswordSchema.parse(input);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.password) throw new Error("NO_PASSWORD_SET");

  const ok = await bcrypt.compare(data.currentPassword, user.password);
  if (!ok) throw new Error("INVALID_CURRENT_PASSWORD");

  const hashed = await bcrypt.hash(data.newPassword, 12);
  await db.user.update({ where: { id: user.id }, data: { password: hashed } });
  return { ok: true };
}
