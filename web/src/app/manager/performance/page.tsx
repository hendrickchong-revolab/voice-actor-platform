import Link from "next/link";

import { getAllAgentMetrics } from "@/actions/metrics";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function isoDayUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ManagerPerformancePage({
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

  const metrics = await getAllAgentMetrics({ from, to });

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
          <CardDescription>Select a date range and export a CSV report.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 md:flex-row md:items-end" action="/manager/performance">
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
            <Button type="submit" variant="secondary">
              Apply
            </Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/api/metrics/report?scope=all&from=${encodeURIComponent(from)}&to=${encodeURIComponent(
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
