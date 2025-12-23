import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { parseS3Uri, s3Client } from "@/lib/s3";
import { uploadToExportBucket } from "@/lib/s3Export";

export const runtime = "nodejs";

const querySchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
});

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[^\w .:@/+-]/.test(s) || /[\n\r",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function extFromKey(key: string) {
  const last = key.split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = last.slice(dot + 1).toLowerCase();
  return ext || null;
}

export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { projectId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const { format } = querySchema.parse({ format: searchParams.get("format") ?? undefined });

  if (!config.exportS3.bucket) {
    return new NextResponse("Missing export bucket (set EXPORT_S3_BUCKET or S3_BUCKET)", { status: 500 });
  }

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, title: true } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  // "At least pass auto scoring" => autoPassed = true.
  const recs = await db.recording.findMany({
    where: {
      script: { projectId },
      autoPassed: true,
      status: { not: "REJECTED" },
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, email: true } },
      script: { select: { id: true, text: true, context: true, projectId: true } },
    },
  });

  const sourceS3 = s3Client();

  const rows: Array<Record<string, unknown>> = [];

  for (const r of recs) {
    const { bucket: sourceBucket, key: sourceKey } = parseS3Uri(r.audioUrl);
    const ext = extFromKey(sourceKey) ?? "webm";

    const sha = (r.audioSha256 ?? "").toLowerCase();
    const filename = sha && /^[a-f0-9]{64}$/.test(sha) ? `${sha}.${ext}` : sourceKey.split("/").pop() ?? `${r.id}.${ext}`;

    const destKey = `${config.exportS3.prefix}/${projectId}/${filename}`;

    const uploaded = await uploadToExportBucket({
      sourceS3,
      sourceBucket,
      sourceKey,
      destKey,
    });

    rows.push({
      projectId,
      projectTitle: project.title,
      recordingId: r.id,
      scriptId: r.scriptId,
      userId: r.userId,
      userEmail: r.user.email,
      createdAt: r.createdAt.toISOString(),
      durationSec: r.durationSec ?? null,
      autoPassed: r.autoPassed ?? null,
      autoScoredAt: r.autoScoredAt ? r.autoScoredAt.toISOString() : null,
      audioSha256: r.audioSha256 ?? null,
      sourceS3Uri: r.audioUrl,
      exportS3Uri: `s3://${uploaded.bucket}/${uploaded.key}`,
      scriptText: r.script.text,
      scriptContext: r.script.context ?? null,
      werScore: r.werScore ?? null,
      snrScore: r.snrScore ?? null,
      mosScore: r.mosScore ?? null,
      transcript: r.transcript ?? null,
    });
  }

  if (format === "json") {
    const body = JSON.stringify(rows, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=project_${projectId}_export.json`,
      },
    });
  }

  // CSV
  const header = [
    "projectId",
    "projectTitle",
    "recordingId",
    "scriptId",
    "userId",
    "userEmail",
    "createdAt",
    "durationSec",
    "autoPassed",
    "autoScoredAt",
    "audioSha256",
    "sourceS3Uri",
    "exportS3Uri",
    "scriptText",
    "scriptContext",
    "werScore",
    "snrScore",
    "mosScore",
    "transcript",
  ];

  const out = [header.join(",")];
  for (const row of rows) {
    out.push(header.map((k) => csvEscape(row[k])).join(","));
  }

  const csv = out.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=project_${projectId}_export.csv`,
    },
  });
}
