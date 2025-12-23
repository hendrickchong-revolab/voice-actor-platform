import Link from "next/link";

import { getMyAgentMetrics } from "@/actions/metrics";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function isoDayUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AgentPerformancePage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; interval?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const today = new Date();
  const defaultTo = isoDayUtc(today);
  const defaultFrom = isoDayUtc(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
  const from = sp.from ?? defaultFrom;
  const to = sp.to ?? defaultTo;
  const interval = sp.interval === "week" || sp.interval === "month" ? sp.interval : "day";

  const m = await getMyAgentMetrics({ from, to });

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
          <CardDescription>Select a date range and download your report.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 md:flex-row md:items-end" action="/agent/performance">
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="from">
                From
              </label>
              <Input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="to">
                To
              </label>
              <Input id="to" name="to" type="date" defaultValue={to} />
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
            <button className={buttonVariants({ variant: "secondary" })} type="submit">
              Apply
            </button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/api/metrics/report?scope=mine&from=${encodeURIComponent(from)}&to=${encodeURIComponent(
                to,
              )}&interval=${encodeURIComponent(interval)}`}
            >
              Download CSV
            </Link>
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
