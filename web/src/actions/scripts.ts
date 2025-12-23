"use server";

import { parse } from "csv-parse/sync";
import { z } from "zod";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { isUserAssignedToProject } from "@/lib/projectAccess";
import { requireRole, requireSession } from "@/lib/session";

type ParsedScriptLine = { text: string; context: string | null };

function normalizeKey(key: string) {
  return key.trim().toLowerCase();
}

function toLinesFromObjects(objects: unknown[]): ParsedScriptLine[] {
  const lines: ParsedScriptLine[] = [];
  for (const obj of objects) {
    if (!obj || typeof obj !== "object") continue;
    const record = obj as Record<string, unknown>;
    const textVal = record.text;
    if (typeof textVal !== "string" || textVal.trim().length === 0) continue;
    const contextVal = record.context;
    lines.push({
      text: textVal.trim(),
      context: typeof contextVal === "string" && contextVal.trim().length > 0 ? contextVal.trim() : null,
    });
  }
  return lines;
}

function parseJsonOrJsonl(raw: string): ParsedScriptLine[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // JSON
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return toLinesFromObjects(parsed);
      }
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        if (Array.isArray(record.items)) return toLinesFromObjects(record.items as unknown[]);
        if (Array.isArray(record.lines)) return toLinesFromObjects(record.lines as unknown[]);
        if (Array.isArray(record.data)) return toLinesFromObjects(record.data as unknown[]);
      }
    } catch {
      // fall through to JSONL/CSV
    }
  }

  // JSONL
  const nonEmpty = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (nonEmpty.length > 0 && nonEmpty.every((l) => l.startsWith("{"))) {
    const objs: unknown[] = [];
    for (const line of nonEmpty) {
      try {
        objs.push(JSON.parse(line) as unknown);
      } catch {
        return null;
      }
    }
    return toLinesFromObjects(objs);
  }

  return null;
}

function parseDelimited(raw: string): ParsedScriptLine[] {
  const firstLine = raw.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";

  const records: Array<Record<string, string>> = parse(raw, {
    columns: (header) => header.map((h: string) => normalizeKey(h)),
    skip_empty_lines: true,
    trim: true,
    delimiter,
  });

  // Enforce `text` column, `context` optional.
  const lines: ParsedScriptLine[] = records
    .map((r) => {
      const text = (r.text ?? "").toString().trim();
      const context = (r.context ?? "").toString().trim();
      return { text, context: context || null };
    })
    .filter((r) => r.text.length > 0);

  return lines;
}

const importAnySchema = z.object({
  projectId: z.string().min(1),
  fileName: z.string().optional(),
  rawText: z.string().min(1),
});

export async function importScriptsAnyFormat(input: unknown) {
  await requireRole(["MANAGER", "ADMIN"]);
  const { projectId, rawText } = importAnySchema.parse(input);

  const jsonLines = parseJsonOrJsonl(rawText);
  const lines = jsonLines ?? parseDelimited(rawText);

  if (lines.length === 0) {
    throw new Error("No valid lines found. Input must include `text` entries.");
  }

  await db.scriptLine.createMany({
    data: lines.map((l) => ({
      projectId,
      text: l.text,
      context: l.context,
    })),
  });

  return { inserted: lines.length };
}

const importCsvSchema = z.object({
  projectId: z.string().min(1),
  csvText: z.string().min(1),
});

export async function importScriptsCsv(input: unknown) {
  await requireRole(["MANAGER", "ADMIN"]);
  const { projectId, csvText } = importCsvSchema.parse(input);

  const records: Array<Record<string, string>> = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const lines = records
    .map((r) => {
      const text = (r.text ?? r.line ?? r.script ?? "").toString().trim();
      const context = (r.context ?? r.direction ?? "").toString().trim();
      return { text, context: context || null };
    })
    .filter((r) => r.text.length > 0);

  if (lines.length === 0) {
    throw new Error("No valid lines found. CSV must include a 'text' column.");
  }

  // Batch insert
  await db.scriptLine.createMany({
    data: lines.map((l) => ({
      projectId,
      text: l.text,
      context: l.context,
    })),
  });

  return { inserted: lines.length };
}

const startSessionSchema = z.object({
  projectId: z.string().min(1),
  batchSize: z.coerce.number().int().min(1).max(50).default(20),
});

export async function releaseExpiredLocks({ minutes = 30 }: { minutes?: number } = {}) {
  // Called opportunistically.
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  await db.scriptLine.updateMany({
    where: {
      status: "LOCKED",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "AVAILABLE",
      lockedByUserId: null,
      lockedAt: null,
    },
  });
}

export async function startAgentSession(input: unknown) {
  const session = await requireSession();
  const { projectId, batchSize } = startSessionSchema.parse(input);

  const allowed = await isUserAssignedToProject({
    userId: session.user.id,
    projectId,
    role: session.user.role,
  });
  if (!allowed) {
    redirect("/unauthorized");
  }

  await releaseExpiredLocks({ minutes: 30 });

  // Try to top up to batchSize.
  const locked: string[] = [];
  const now = new Date();

  while (locked.length < batchSize) {
    const remaining = batchSize - locked.length;
    const candidates = await db.scriptLine.findMany({
      where: { projectId, status: "AVAILABLE" },
      select: { id: true },
      take: remaining,
    });

    if (candidates.length === 0) break;

    const ids = candidates.map((c: { id: string }) => c.id);
    const res = await db.scriptLine.updateMany({
      where: {
        id: { in: ids },
        status: "AVAILABLE",
        lockedByUserId: null,
      },
      data: {
        status: "LOCKED",
        lockedByUserId: session.user.id,
        lockedAt: now,
      },
    });

    if (res.count === 0) continue;

    const fetched = await db.scriptLine.findMany({
      where: {
        id: { in: ids },
        lockedByUserId: session.user.id,
        status: "LOCKED",
      },
      select: { id: true },
    });

    locked.push(...fetched.map((f: { id: string }) => f.id));
  }

  const scripts = await db.scriptLine.findMany({
    where: {
      projectId,
      lockedByUserId: session.user.id,
      status: "LOCKED",
    },
    orderBy: { lockedAt: "asc" },
  });

  return { scripts };
}

export async function getMyLockedScripts(projectId: string) {
  const session = await requireSession();

  const allowed = await isUserAssignedToProject({
    userId: session.user.id,
    projectId,
    role: session.user.role,
  });
  if (!allowed) {
    redirect("/unauthorized");
  }

  return db.scriptLine.findMany({
    where: {
      projectId,
      lockedByUserId: session.user.id,
      status: "LOCKED",
    },
    orderBy: { lockedAt: "asc" },
  });
}
