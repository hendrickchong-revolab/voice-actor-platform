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
import { ProjectAssignmentsPicker } from "@/components/ProjectAssignmentsPicker";

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

  const agents = (await db.user.findMany(
    ({
      where: { role: "AGENT" },
      // NOTE: `languages` is added via migration `20251231090000_add_user_languages`.
      // Some TS environments may have stale Prisma client types until `prisma generate` refreshes.
      select: { id: true, email: true, name: true, languages: true },
      orderBy: { createdAt: "desc" },
    } as unknown) as Parameters<typeof db.user.findMany>[0],
  )) as Array<{ id: string; email: string; name: string | null; languages?: string[] }>;

  const assigned: Array<{ userId: string }> = await db.projectAssignment.findMany({
    where: { projectId },
    select: { userId: true },
  });

  const assignedSet = new Set(assigned.map((a) => a.userId));
  const initialAssignedIds = Array.from(assignedSet);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link 
            className={buttonVariants({ variant: "ghost", size: "sm" })} 
            href="/manager/projects"
          >
            ← Back to Projects
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {project.description ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{project.description}</p>
              </div>
            ) : null}
            {project.language ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Language</p>
                <p className="text-sm">{project.language}</p>
              </div>
            ) : null}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Script Count</p>
              <p className="text-sm">{scriptCount}</p>
            </div>
          </div>

          <div className="pt-2 border-t">
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
            {agents.length === 0 ? <p className="text-sm">No agent accounts found.</p> : null}

            <ProjectAssignmentsPicker
              agents={agents}
              initialAssignedIds={initialAssignedIds}
              projectLanguage={project.language}
            />

            <Button type="submit" className="w-full sm:w-auto">Save Assignments</Button>
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
