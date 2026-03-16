import { db } from "@/lib/db";

export type ReevaluateQcResult = {
  scanned: number;
  updated: number;
  toApproved: number;
  toFlagged: number;
  skippedMissingMetrics: number;
};

export async function reevaluateNisqaThresholds({
  minScoreOverride,
  projectId,
  take = 500,
}: {
  minScoreOverride?: number;
  projectId?: string;
  take?: number;
}): Promise<ReevaluateQcResult> {
  const safeOverride = Number.isFinite(minScoreOverride ?? NaN)
    ? (minScoreOverride as number)
    : undefined;
  const safeTake = Math.max(1, Math.min(5000, Math.floor(take)));

  const candidates = await db.recording.findMany({
    where: {
      autoScoredAt: { not: null },
      reviewedBy: null,
      status: { in: ["FLAGGED", "APPROVED"] },
      ...(projectId ? { script: { projectId } } : {}),
    },
    select: {
      id: true,
      status: true,
      mosScore: true,
      meanScore: true,
      nisqaNoiPred: true,
      nisqaDisPred: true,
      nisqaColPred: true,
      nisqaLoudPred: true,
      script: {
        select: {
          project: {
            select: {
              targetMos: true,
              nisqaMinScore: true,
            },
          },
        },
      },
    },
    orderBy: { autoScoredAt: "desc" },
    take: safeTake,
  });

  let updated = 0;
  let toApproved = 0;
  let toFlagged = 0;
  let skippedMissingMetrics = 0;

  for (const r of candidates) {
    const meanScore = r.meanScore ?? (() => {
      if (
        r.nisqaNoiPred == null ||
        r.nisqaDisPred == null ||
        r.nisqaColPred == null ||
        r.nisqaLoudPred == null
      ) {
        return null;
      }
      return (
        r.nisqaNoiPred +
        r.nisqaDisPred +
        r.nisqaColPred +
        r.nisqaLoudPred
      ) / 4;
    })();

    if (r.mosScore == null || meanScore == null) {
      skippedMissingMetrics += 1;
      continue;
    }

    const targetMos = r.script.project.targetMos ?? 3.5;
    const effectiveMin = safeOverride ?? r.script.project.nisqaMinScore ?? 3.5;

    const passed = r.mosScore >= targetMos && meanScore >= effectiveMin;

    const desiredStatus = passed ? "APPROVED" : "FLAGGED";
    if (desiredStatus === r.status) continue;

    await db.recording.update({
      where: { id: r.id },
      data: {
        status: desiredStatus,
        autoPassed: passed,
        reviewNote:
          (r.status === "FLAGGED" && desiredStatus === "APPROVED")
            ? `Auto-reapproved after threshold change (mean>=${effectiveMin.toFixed(2)}, mos>=${targetMos.toFixed(2)}).`
            : `Auto-flagged after threshold change (mean>=${effectiveMin.toFixed(2)}, mos>=${targetMos.toFixed(2)}).`,
      },
      select: { id: true },
    });

    updated += 1;
    if (desiredStatus === "APPROVED") toApproved += 1;
    else toFlagged += 1;
  }

  return {
    scanned: candidates.length,
    updated,
    toApproved,
    toFlagged,
    skippedMissingMetrics,
  };
}
