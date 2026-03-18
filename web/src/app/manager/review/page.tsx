import Link from "next/link";
import { redirect } from "next/navigation";

import { approveRecording, listPendingForManager, rejectRecording } from "@/actions/recordings";
import { Modal } from "@/components/Modal";
import {
  getManualReviewSession,
  listManualReviewSessions,
  listReviewableAgents,
  submitManualReviewDecision,
} from "@/lib/manualReviewSessions";
import { requireSession } from "@/lib/session";
import { StartEvaluationSessionForm } from "@/components/StartEvaluationSessionForm";

export const dynamic = "force-dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InlineAudioPlayer } from "@/components/InlineAudioPlayer";
import { Badge } from "@/components/ui/badge";

function toPercent(v: number | null | undefined) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function errorMessage(code?: string) {
  if (!code) return null;
  if (code === "TARGET_USER_REQUIRED") return "Please select an agent first.";
  if (code === "PROJECT_REQUIRED") return "Please select a project.";
  if (code === "INVALID_SAMPLE_SIZE") return "Sample size must be between 1 and 50.";
  if (code === "NOT_ENOUGH_ELIGIBLE_RECORDINGS") {
    return "Selected agent does not have enough recordings for the requested sample size.";
  }
  if (code === "SESSION_ITEM_NOT_FOUND") return "Session item not found.";
  if (code === "FORBIDDEN_SESSION_OWNER") return "Only the session owner can submit decisions in this session.";
  if (code === "SESSION_ALREADY_COMPLETED") return "This evaluation session is already completed.";
  if (code === "ITEM_ALREADY_REVIEWED") return "This item is already reviewed.";
  return code;
}

export default async function ManagerReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{
    eval?: string;
    session?: string;
    created?: string;
    error?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const recordings = await listPendingForManager();
  const reviewableAgents = await listReviewableAgents();
  const sessions = await listManualReviewSessions(30);
  const activeSession = sp.session ? await getManualReviewSession(sp.session) : null;
  const closeHref = "/manager/review";

  type RecordingItem = Awaited<ReturnType<typeof listPendingForManager>>[number];

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Start an evaluation session by selecting one agent and a sample size (max 50). Sessions can sample from all non-processing recordings. The score is computed only when all selected items are reviewed.
            </p>
            <Link href="/manager/review?eval=1">
              <Button type="button" variant="secondary">Start Evaluation Session</Button>
            </Link>
          </div>

          {sp.created ? <p className="text-sm text-muted-foreground">Evaluation session created.</p> : null}
          {sp.error ? <p className="text-sm text-destructive">{errorMessage(sp.error)}</p> : null}

          {recordings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending recordings.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Approve or reject pending recordings.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evaluation Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evaluation sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div className="text-sm">
                    <div className="font-medium">Target: {s.targetUserEmail}</div>
                    <div className="text-muted-foreground">
                      Project: {s.projectTitle}
                    </div>
                    <div className="text-muted-foreground">
                      {s.reviewedItems}/{s.totalItems} reviewed • approved {s.approvedItems} • rejected {s.rejectedItems}
                    </div>
                    <div className="text-muted-foreground">
                      {s.completedAt
                        ? `Completed ${new Date(s.completedAt).toLocaleString()} • Score ${
                            s.scorePercent?.toFixed(1) ?? "0.0"
                          }%`
                        : `Created ${new Date(s.createdAt).toLocaleString()} • In progress`}
                    </div>
                  </div>
                  <Link href={`/manager/review?session=${encodeURIComponent(s.id)}`}>
                    <Button type="button" variant="outline" size="sm">
                      Open Session
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {recordings.map((r: RecordingItem) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="text-base">{r.user.email}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">Script</div>
                <div className="text-muted-foreground">
                  {r.script.text}
                  {r.script.context ? ` (${r.script.context})` : ""}
                </div>
              </div>

              <div className="space-y-1">
                <InlineAudioPlayer recordingId={r.id} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  If audio doesn’t play, refresh (check the network tab for redirects).
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <form
                  className="flex items-center gap-2"
                  action={async (fd) => {
                    "use server";
                    await approveRecording({
                      recordingId: r.id,
                      note: fd.get("note"),
                    });
                  }}
                >
                  <Input name="note" placeholder="Optional note" autoComplete="off" autoCorrect="off" />
                  <Button type="submit">Approve</Button>
                </form>
                <form
                  className="flex items-center gap-2"
                  action={async (fd) => {
                    "use server";
                    await rejectRecording({
                      recordingId: r.id,
                      note: fd.get("note"),
                    });
                  }}
                >
                  <Input name="note" placeholder="Optional note" autoComplete="off" autoCorrect="off" />
                  <Button type="submit" variant="destructive">
                    Reject
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sp.eval === "1" ? (
        <Modal title="Start Evaluation Session" description="Select one agent and sample size (max 50)." closeHref={closeHref}>
          <StartEvaluationSessionForm
            agents={reviewableAgents.map((a) => ({
              userId: a.userId,
              email: a.email,
              eligibleCount: a.eligibleCount,
            }))}
          />
        </Modal>
      ) : null}

      {activeSession ? (
        <Modal
          title="Evaluation Session"
          description={`Target: ${activeSession.targetUserEmail} • Project: ${activeSession.projectTitle} • ${activeSession.reviewedItems}/${activeSession.totalItems} reviewed`}
          closeHref={closeHref}
          widthClassName="max-w-5xl"
        >
          <div className="mb-4 grid gap-3 rounded-md border p-3 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Progress</div>
              <div className="text-sm font-medium">
                {activeSession.reviewedItems}/{activeSession.totalItems}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Approve ratio</div>
              <div className="text-sm font-medium">{toPercent(activeSession.approveRatio)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Reject ratio</div>
              <div className="text-sm font-medium">{toPercent(activeSession.rejectRatio)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Score</div>
              <div className="text-sm font-medium">
                {typeof activeSession.scorePercent === "number"
                  ? `${activeSession.scorePercent.toFixed(1)}%`
                  : "Pending completion"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {activeSession.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">Item</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Recording: {item.recordingStatus}</Badge>
                      {item.decision ? (
                        <Badge variant={item.decision === "APPROVED" ? "secondary" : "destructive"}>
                          {item.decision}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending decision</Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-sm">
                    <div className="font-medium">Script</div>
                    <div className="text-muted-foreground">
                      {item.scriptText}
                      {item.scriptContext ? ` (${item.scriptContext})` : ""}
                    </div>
                  </div>

                  <InlineAudioPlayer recordingId={item.recordingId} className="w-full" />

                  {item.decision ? (
                    <p className="text-xs text-muted-foreground">
                      Reviewed {item.decidedAt ? new Date(item.decidedAt).toLocaleString() : ""}
                      {item.note ? ` • Note: ${item.note}` : ""}
                    </p>
                  ) : (
                    <form
                      className="grid gap-2 md:grid-cols-[1fr_auto_auto]"
                      action={async (fd) => {
                        "use server";

                        try {
                          const actor = await requireSession();
                          const decision = String(fd.get("decision") ?? "");
                          if (decision !== "APPROVED" && decision !== "REJECTED") {
                            throw new Error("INVALID_DECISION");
                          }

                          await submitManualReviewDecision({
                            sessionId: activeSession.id,
                            itemId: item.id,
                            decision,
                            note: String(fd.get("note") ?? ""),
                            actorUserId: actor.user.id,
                          });

                          redirect(`/manager/review?session=${encodeURIComponent(activeSession.id)}`);
                        } catch (e) {
                          const code = e instanceof Error ? e.message : "UNKNOWN";
                          redirect(
                            `/manager/review?session=${encodeURIComponent(activeSession.id)}&error=${encodeURIComponent(code)}`,
                          );
                        }
                      }}
                    >
                      <Input name="note" placeholder="Optional note" autoComplete="off" autoCorrect="off" />
                      <Button type="submit" name="decision" value="APPROVED">
                        Approve
                      </Button>
                      <Button type="submit" name="decision" value="REJECTED" variant="destructive">
                        Reject
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
