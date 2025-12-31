import { db } from "@/lib/db";
import { importScriptsAnyFormat } from "@/actions/scripts";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExportProjectButton } from "@/components/ExportProjectButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ManagerProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ imported?: string; importError?: string }>;
}) {
  const { projectId } = await params;
  const sp = (await searchParams) ?? {};
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return <main className="space-y-6">Not found</main>;

  const scriptCount = await db.scriptLine.count({ where: { projectId } });

  const agents = await db.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  const assigned: Array<{ userId: string }> = await db.projectAssignment.findMany({
    where: { projectId },
    select: { userId: true },
  });

  const assignedSet = new Set(assigned.map((a) => a.userId));

  return (
    <main className="space-y-6">
      <div>
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/manager/projects">
          ← Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{project.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {project.description ? (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description.</p>
          )}
          {project.language ? (
            <p className="text-sm text-muted-foreground">Language: {project.language}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">Scripts: {scriptCount}</p>

          <div className="pt-2">
            <ExportProjectButton projectId={projectId} />
          </div>
        </CardContent>
      </Card>

      {sp.imported ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm">Imported {sp.imported} lines.</p>
          </CardContent>
        </Card>
      ) : null}

      {sp.importError ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-destructive">Import failed: {sp.importError}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Project Access (Assignments)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Only assigned agents can see this project and start sessions.
          </p>

          <form
            className="space-y-3"
            action={async (formData) => {
              "use server";
              await requireRole(["MANAGER", "ADMIN"]);

              const agentIds = formData
                .getAll("agentIds")
                .map((v) => String(v))
                .filter(Boolean);

              await db.$transaction([
                db.projectAssignment.deleteMany({
                  where: {
                    projectId,
                    userId: { notIn: agentIds },
                  },
                }),
                db.projectAssignment.createMany({
                  data: agentIds.map((userId) => ({ projectId, userId })),
                  skipDuplicates: true,
                }),
              ]);

              revalidatePath(`/manager/projects/${projectId}`);
              revalidatePath("/agent/tasks");
              redirect(`/manager/projects/${projectId}`);
            }}
          >
            {agents.length === 0 ? (
              <p className="text-sm">No agent accounts found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="w-28">
                        <input
                          id={`agent_${a.id}`}
                          type="checkbox"
                          name="agentIds"
                          value={a.id}
                          defaultChecked={assignedSet.has(a.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <label htmlFor={`agent_${a.id}`} className="cursor-pointer">
                          {a.name ? `${a.name} — ` : ""}
                          {a.email}
                        </label>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Button type="submit">Save assignments</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Scripts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload CSV/TSV/JSON/JSONL (or any text file) containing a <span className="font-mono">text</span> field.
            <span className="font-mono"> context</span> is optional.
          </p>
          <form
            className="space-y-3"
            action={async (formData) => {
              "use server";
              try {
                const file = formData.get("file");
                if (!(file instanceof File)) {
                  redirect(`/manager/projects/${projectId}?importError=${encodeURIComponent("No file selected")}`);
                }

                const rawText = await file.text();
                const res = await importScriptsAnyFormat({
                  projectId,
                  fileName: file.name,
                  rawText,
                });

                redirect(`/manager/projects/${projectId}?imported=${encodeURIComponent(String(res.inserted))}`);
              } catch (e) {
                if (isRedirectError(e)) throw e;
                const msg = e instanceof Error ? e.message : "Unknown error";
                redirect(`/manager/projects/${projectId}?importError=${encodeURIComponent(msg)}`);
              }
            }}
          >
            <input
              name="file"
              type="file"
              className="block w-full text-sm"
              accept=".csv,.tsv,.json,.jsonl,text/*,application/json"
              required
            />
            <Button type="submit" variant="secondary">
              Import
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
