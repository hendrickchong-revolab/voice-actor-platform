import Link from "next/link";

import { getRecordingsLogPage } from "@/actions/recordings";
import { config } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAudioPlayer } from "@/components/InlineAudioPlayer";
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
    <main className="space-y-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recordings Log</h1>
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
            Includes audio playback link, script text, agent identity, status, and MOS score.
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

          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[200px]">Project</TableHead>
                <TableHead className="w-[220px]">Agent</TableHead>
                <TableHead className="w-[420px]">Text</TableHead>
                <TableHead className="w-[280px]">Audio</TableHead>
                <TableHead className="w-[160px] text-right">MOS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordings.map((r: RecordingItem) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.script.project.title}</TableCell>
                  <TableCell>
                    <div className="text-sm truncate">{r.user.email}</div>
                    {r.user.name ? (
                      <div className="text-xs text-muted-foreground">{r.user.name}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="w-[420px] max-w-[420px]">
                    <div className="truncate text-sm">{r.script.text}</div>
                    {r.script.context ? (
                      <div className="truncate text-xs text-muted-foreground">{r.script.context}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="w-[280px]">
                    <InlineAudioPlayer recordingId={r.id} className="w-[240px]" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.mosScore != null ? (
                      <div className="space-y-1">
                        <div>
                          {r.mosScore >= r.script.project.targetMos ? (
                            <Badge variant="default">Pass</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          MOS {r.mosScore.toFixed(2)} / {r.script.project.targetMos.toFixed(2)}
                        </div>
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
