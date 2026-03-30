import Link from "next/link";

import { getMyAgentMetrics } from "@/actions/metrics";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function isoDayUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AgentPerformancePage({
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

  const m = allTime ? await getMyAgentMetrics() : await getMyAgentMetrics({ from, to });

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Performance</h1>
        <Link className="text-sm underline" href="/agent">
          Back to Agent
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Choose a time window, then apply filters or export your metrics.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action="/agent/performance">
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
              <Link className={buttonVariants({ variant: "ghost" })} href="/agent/performance">
                Reset
              </Link>
              <SubmitButton variant="secondary">Apply filters</SubmitButton>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={
                  allTime
                    ? `/api/metrics/report?scope=mine&allTime=1&interval=${encodeURIComponent(interval)}`
                    : `/api/metrics/report?scope=mine&from=${encodeURIComponent(from)}&to=${encodeURIComponent(
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
          <CardTitle>Contribution metrics</CardTitle>
          <CardDescription>
            Totals exclude REJECTED. “Auto-passed duration” counts recordings where the automatic scorer marked the submission as passing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Total task count</div>
            <div className="font-medium tabular-nums">{m.totalCount}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Total duration (sec)</div>
            <div className="font-medium tabular-nums">{m.totalDurationSec.toFixed(2)}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Auto-passed duration (sec)</div>
            <div className="font-medium tabular-nums">{m.autoPassedDurationSec.toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
