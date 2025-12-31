import Link from "next/link";

import { getRecordingsLogPage } from "@/actions/recordings";
import { config } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED") return "destructive";
  if (status === "FLAGGED") return "secondary";
  return "outline";
}

export default async function ManagerRecordingsLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; pageSize?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;
  const requestedPageSize = Number.parseInt(sp.pageSize ?? "", 10);
  const defaultPageSize = config.recordingsLog.defaultPageSize;
  const maxPageSize = config.recordingsLog.maxPageSize;
  const pageSize = Math.min(
    maxPageSize,
    Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? requestedPageSize : defaultPageSize,
  );

  const { items: recordings, total } = await getRecordingsLogPage({ page, pageSize });

  type RecordingItem = (typeof recordings)[number];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Recordings Log</h1>
          <p className="text-sm text-muted-foreground">
            Showing {recordings.length} of {total} recordings.
          </p>
        </div>
        <Link className="text-sm underline" href="/manager">
          Back to Manager
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All recordings</CardTitle>
          <CardDescription>
            Includes audio playback link, script text, agent identity, status, duration and scores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages} • {pageSize}/page
            </div>
            <div className="flex items-center gap-3">
              {prevPage ? (
                <Link
                  className="text-sm underline"
                  href={`/manager/recordings?page=${encodeURIComponent(String(prevPage))}&pageSize=${encodeURIComponent(
                    String(pageSize),
                  )}`}
                >
                  Prev
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">Prev</span>
              )}
              {nextPage ? (
                <Link
                  className="text-sm underline"
                  href={`/manager/recordings?page=${encodeURIComponent(String(nextPage))}&pageSize=${encodeURIComponent(
                    String(pageSize),
                  )}`}
                >
                  Next
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">Next</span>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Text</TableHead>
                <TableHead>Audio</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">WER</TableHead>
                <TableHead className="text-right">SNR</TableHead>
                <TableHead className="text-right">MOS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordings.map((r: RecordingItem) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </TableCell>
                  <TableCell>{r.script.project.title}</TableCell>
                  <TableCell>
                    <div className="text-sm">{r.user.email}</div>
                    {r.user.name ? (
                      <div className="text-xs text-muted-foreground">{r.user.name}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[520px]">
                    <div className="truncate text-sm">{r.script.text}</div>
                    {r.script.context ? (
                      <div className="truncate text-xs text-muted-foreground">{r.script.context}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <audio
                      controls
                      preload="none"
                      src={`/api/uploads/play?recordingId=${encodeURIComponent(r.id)}`}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.durationSec != null ? r.durationSec.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.werScore != null ? r.werScore.toFixed(3) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.snrScore != null ? r.snrScore.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.mosScore != null ? (
                      <div className="space-y-0.5">
                        <div>{r.mosScore.toFixed(2)}</div>
                        {r.nisqaNoiPred != null || r.nisqaDisPred != null || r.nisqaColPred != null || r.nisqaLoudPred != null ? (
                          <div className="text-[11px] text-muted-foreground">
                            {r.nisqaNoiPred != null ? `NOI ${r.nisqaNoiPred.toFixed(2)} ` : ""}
                            {r.nisqaDisPred != null ? `DIS ${r.nisqaDisPred.toFixed(2)} ` : ""}
                            {r.nisqaColPred != null ? `COL ${r.nisqaColPred.toFixed(2)} ` : ""}
                            {r.nisqaLoudPred != null ? `LOUD ${r.nisqaLoudPred.toFixed(2)}` : ""}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
