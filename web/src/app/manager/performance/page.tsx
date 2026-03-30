import Link from "next/link";

import { getAllAgentMetrics } from "@/actions/metrics";
import { Button, buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function isoDayUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ManagerPerformancePage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; interval?: string; allTime?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const today = new Date();
  const defaultTo = isoDayUtc(today);
  const defaultFrom = isoDayUtc(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));

  const from = sp.from ?? defaultFrom;
  const to = sp.to ?? defaultTo;
  const interval = sp.interval === "week" || sp.interval === "month" ? sp.interval : "day";
  const allTime = sp.allTime === "1";

  const metrics = allTime ? await getAllAgentMetrics() : await getAllAgentMetrics({ from, to });

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agent Performance</h1>
          <p className="text-sm text-muted-foreground">
            Totals exclude REJECTED. Auto-passed duration is based on the worker’s automatic decision.
          </p>
        </div>
        <Link className="text-sm underline" href="/manager">
          Back to Manager
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Choose a time window, then apply filters or export a report.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action="/manager/performance">
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date window</div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="allTime">
                    Range
                  </label>
                  <select
                    id="allTime"
                    name="allTime"
                    defaultValue={allTime ? "1" : "0"}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="0">Custom range</option>
                    <option value="1">All time</option>
                  </select>
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="from">
                    From
                  </label>
                  <Input id="from" name="from" type="date" defaultValue={from} disabled={allTime} />
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="to">
                    To
                  </label>
                  <Input id="to" name="to" type="date" defaultValue={to} disabled={allTime} />
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="interval">
                    Interval
                  </label>
                  <select
                    id="interval"
                    name="interval"
                    defaultValue={interval}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {allTime
                  ? "All time selected: date fields are ignored."
                  : "Custom range selected: results include recordings between From and To dates (inclusive)."}
              </p>
            </div>

            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
              <Link className={buttonVariants({ variant: "ghost" })} href="/manager/performance">
                Reset
              </Link>
              <SubmitButton variant="secondary">Apply filters</SubmitButton>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={
                  allTime
                    ? `/api/metrics/report?scope=all&allTime=1&interval=${encodeURIComponent(interval)}`
                    : `/api/metrics/report?scope=all&from=${encodeURIComponent(from)}&to=${encodeURIComponent(
                        to,
                      )}&interval=${encodeURIComponent(interval)}`
                }
              >
                Export CSV
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>Basic contribution metrics per agent.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Duration (sec)</TableHead>
                <TableHead className="text-right">Auto-passed (sec)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell>
                    <div className="text-sm">{m.email}</div>
                    {m.name ? (
                      <div className="text-xs text-muted-foreground">{m.name}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.totalCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.totalDurationSec.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.autoPassedDurationSec.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
