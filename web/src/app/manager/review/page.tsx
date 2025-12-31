import { approveRecording, listPendingForManager, rejectRecording } from "@/actions/recordings";

export const dynamic = "force-dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InlineAudioPlayer } from "@/components/InlineAudioPlayer";

export default async function ManagerReviewPage() {
  const recordings = await listPendingForManager();

  type RecordingItem = Awaited<ReturnType<typeof listPendingForManager>>[number];

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Review</CardTitle>
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending recordings.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Approve or reject pending recordings.</p>
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
    </main>
  );
}
