import Link from "next/link";

import { listProjectsForAgent } from "@/actions/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AgentTasksProjectsPage() {
  const projects = await listProjectsForAgent();
  type ProjectItem = Awaited<ReturnType<typeof listProjectsForAgent>>[number];

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Select a project and start tasks one-by-one.</p>

          {projects.length === 0 ? (
            <p className="text-sm">No projects assigned yet. Ask a manager to assign you to a project.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p: ProjectItem) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.title}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        className={buttonVariants({ size: "sm" })}
                        href={`/agent/tasks/${encodeURIComponent(p.id)}`}
                      >
                        Start tasks
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
