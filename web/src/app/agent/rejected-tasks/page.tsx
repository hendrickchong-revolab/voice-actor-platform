import Link from "next/link";

import { listProjectsForAgent } from "@/actions/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/session";
import { getRejectedTaskCountsByProject } from "@/lib/rejectedTasks";

export const dynamic = "force-dynamic";

export default async function AgentRejectedTasksProjectsPage() {
  const session = await requireSession();
  const projects = await listProjectsForAgent();
  const counts = await getRejectedTaskCountsByProject({ userId: session.user.id });

  const rows = projects.map((p) => ({ ...p, rejectedCount: counts.get(p.id) ?? 0 }));

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Review Rejected Tasks</h1>
        <p className="text-muted-foreground">Pick a project to re-record tasks rejected by quality checks.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Assigned Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm">No projects assigned yet. Ask a manager to assign you to a project.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Rejected Tasks</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.title}</TableCell>
                    <TableCell>{p.rejectedCount}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        className={buttonVariants({ size: "sm" })}
                        href={`/agent/rejected-tasks/${encodeURIComponent(p.id)}`}
                      >
                        Start review
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
