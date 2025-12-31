import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { parseS3Uri, s3Client } from "@/lib/s3";
import { uploadToExportBucket } from "@/lib/s3Export";

export const runtime = "nodejs";

const querySchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  include: z.enum(["approved", "auto", "approved_or_auto", "all_non_rejected"]).default("approved_or_auto"),
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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { projectId } = await ctx.params;
    const { searchParams } = new URL(req.url);
    
    let parsedQuery;
    try {
      parsedQuery = querySchema.parse({
        format: searchParams.get("format") ?? undefined,
        include: searchParams.get("include") ?? undefined,
      });
    } catch {
      return new NextResponse("Invalid query parameters", { status: 400 });
    }
    const { format, include } = parsedQuery;

    if (!config.exportS3.bucket) {
      return new NextResponse("Missing export bucket (set EXPORT_S3_BUCKET or S3_BUCKET)", { status: 500 });
    }

    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, title: true } });
    if (!project) return new NextResponse("Project not found", { status: 404 });

  // Exportable recordings are usually manager-approved.
  // If the auto-scoring worker is enabled, it may also set `autoPassed=true`.
  let where: Prisma.RecordingWhereInput;
  if (include === "approved") {
    where = { script: { projectId }, status: "APPROVED" };
  } else if (include === "auto") {
    where = { script: { projectId }, autoPassed: true, status: { not: "REJECTED" } };
  } else if (include === "all_non_rejected") {
    where = { script: { projectId }, status: { not: "REJECTED" } };
  } else {
    where = {
      script: { projectId },
      status: { not: "REJECTED" },
      OR: [{ status: "APPROVED" }, { autoPassed: true }],
    };
  }

  // Fetch recordings with related data
  const recs = await db.recording.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, email: true } },
      script: { select: { id: true, text: true, context: true, projectId: true } },
    },
  });

  // Fetch all ScriptLines (tasks) for this project
  const scriptLines = await db.scriptLine.findMany({
    where: { projectId },
    orderBy: { id: "asc" },
    include: {
      recordings: {
        select: {
          id: true,
          userId: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const sourceS3 = s3Client();

  // Build recording rows with audio file export
  const recordingRows: Array<Record<string, unknown>> = [];

  for (const r of recs) {
    let exportedAudioUri: string | null = null;
    
    try {
      const { bucket: sourceBucket, key: sourceKey } = parseS3Uri(r.audioUrl);
      const ext = extFromKey(sourceKey) ?? "webm";

      const sha = (r.audioSha256 ?? "").toLowerCase();
      const filename = sha && /^[a-f0-9]{64}$/.test(sha) ? `${sha}.${ext}` : sourceKey.split("/").pop() ?? `${r.id}.${ext}`;

      const destKey = `${config.exportS3.prefix}/${projectId}/audio/${filename}`;

      const uploaded = await uploadToExportBucket({
        sourceS3,
        sourceBucket,
        sourceKey,
        destKey,
      });

      if (uploaded) {
        exportedAudioUri = `s3://${uploaded.bucket}/${uploaded.key}`;
      }
    } catch (error) {
      // If parsing S3 URI fails or other errors, continue without exported audio
      console.warn(`Failed to export audio for recording ${r.id}:`, error);
    }

    recordingRows.push({
      rowType: "recording",
      projectId,
      projectTitle: project.title,
      scriptId: r.scriptId,
      scriptText: r.script.text,
      scriptContext: r.script.context ?? null,
      scriptStatus: null,
      lockedByUserId: null,
      lockedAt: null,
      recordingCount: null,
      approvedRecordingCount: null,
      latestRecordingId: null,
      latestRecordingUserId: null,
      latestRecordingStatus: null,
      latestRecordingCreatedAt: null,
      recordingId: r.id,
      userId: r.userId,
      userEmail: r.user.email,
      createdAt: r.createdAt.toISOString(),
      durationSec: r.durationSec ?? null,
      autoPassed: r.autoPassed ?? null,
      autoScoredAt: r.autoScoredAt ? r.autoScoredAt.toISOString() : null,
      audioSha256: r.audioSha256 ?? null,
      sourceS3Uri: r.audioUrl,
      exportS3Uri: exportedAudioUri,
      werScore: r.werScore ?? null,
      snrScore: r.snrScore ?? null,
      mosScore: r.mosScore ?? null,
      transcript: r.transcript ?? null,
    });
  }

  // Build script line (task) rows
  const taskRows: Array<Record<string, unknown>> = scriptLines.map((script) => ({
    rowType: "task",
    projectId,
    projectTitle: project.title,
    scriptId: script.id,
    scriptText: script.text,
    scriptContext: script.context ?? null,
    scriptStatus: script.status,
    lockedByUserId: script.lockedByUserId ?? null,
    lockedAt: script.lockedAt ? script.lockedAt.toISOString() : null,
    recordingCount: script.recordings.length,
    approvedRecordingCount: script.recordings.filter((r) => r.status === "APPROVED").length,
    latestRecordingId: script.recordings[0]?.id ?? null,
    latestRecordingUserId: script.recordings[0]?.userId ?? null,
    latestRecordingStatus: script.recordings[0]?.status ?? null,
    latestRecordingCreatedAt: script.recordings[0]?.createdAt ? script.recordings[0].createdAt.toISOString() : null,
    recordingId: null,
    userId: null,
    userEmail: null,
    createdAt: null,
    durationSec: null,
    autoPassed: null,
    autoScoredAt: null,
    audioSha256: null,
    sourceS3Uri: null,
    exportS3Uri: null,
    werScore: null,
    snrScore: null,
    mosScore: null,
    transcript: null,
  }));

  // Combine data: tasks first, then recordings
  const rows = [...taskRows, ...recordingRows];

  if (format === "json") {
    const body = JSON.stringify(rows, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=project_${projectId}_export.json`,
        "X-Export-Include": include,
        "X-Export-Count": String(rows.length),
        "X-Export-Tasks-Count": String(taskRows.length),
        "X-Export-Recordings-Count": String(recordingRows.length),
      },
    });
  }

  // CSV - include both task and recording fields
  const header = [
    "rowType",
    "projectId",
    "projectTitle",
    "scriptId",
    "scriptText",
    "scriptContext",
    "scriptStatus",
    "lockedByUserId",
    "lockedAt",
    "recordingCount",
    "approvedRecordingCount",
    "latestRecordingId",
    "latestRecordingUserId",
    "latestRecordingStatus",
    "latestRecordingCreatedAt",
    "recordingId",
    "userId",
    "userEmail",
    "createdAt",
    "durationSec",
    "autoPassed",
    "autoScoredAt",
    "audioSha256",
    "sourceS3Uri",
    "exportS3Uri",
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
      "X-Export-Include": include,
      "X-Export-Count": String(rows.length),
      "X-Export-Tasks-Count": String(taskRows.length),
      "X-Export-Recordings-Count": String(recordingRows.length),
    },
  });
  } catch (error) {
    console.error("Export error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(
      JSON.stringify({ error: "Export failed", message: errorMessage }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
