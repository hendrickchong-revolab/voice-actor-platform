import { createProject, getProjectsPage, updateProjectAdvanced, updateProjectGeneral } from "@/actions/projects";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { importScriptsAnyFormat } from "@/actions/scripts";
import { ProjectAssignmentsPicker } from "@/components/ProjectAssignmentsPicker";
import { Modal } from "@/components/Modal";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TabId = "general" | "access" | "import" | "advanced";
const tabs: Array<{ id: TabId; label: string }> = [
  { id: "general", label: "General" },
  { id: "access", label: "Project Access" },
  { id: "import", label: "Import Data" },
  { id: "advanced", label: "Advanced" },
];

function createHref(page: number) {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("create", "1");
  return `/manager/projects?${qs.toString()}`;
}

function manageTabHref({ edit, tab, page }: { edit: string; tab: TabId; page: number }) {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("tab", tab);
  qs.set("edit", edit);
  return `/manager/projects?${qs.toString()}`;
}

export default async function ManagerProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; create?: string; edit?: string; tab?: string; saved?: string; imported?: string; error?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;
  const pageSize = 10;
  const { items: projects, total } = await getProjectsPage({ page, pageSize });
  type ProjectItem = (typeof projects)[number];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const editId = sp.edit;
  const isCreate = sp.create === "1" && !editId;
  const activeTab = (sp.tab as TabId) || "general";

  const editingProject = editId
    ? await db.project.findUnique({ where: { id: editId } })
    : null;

  const agentsForAccessTab =
    editingProject && activeTab === "access"
      ? await db.user.findMany({
          where: { role: "AGENT" },
          select: { id: true, email: true, name: true, languages: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const assignedForAccessTab =
    editingProject && activeTab === "access"
      ? await db.projectAssignment.findMany({
          where: { projectId: editingProject.id },
          select: { userId: true },
        })
      : [];
  const initialAssignedIdsForAccessTab = Array.from(
    new Set(assignedForAccessTab.map((a) => a.userId)),
  );

  const closeHref = `/manager/projects?page=${encodeURIComponent(String(page))}`;

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage projects and their settings.</p>
        </div>
        <Link href={createHref(page)}>
          <Button type="button" variant="secondary">Create New</Button>
        </Link>
      </div>

      {sp.saved ? <p className="text-sm text-muted-foreground">Saved.</p> : null}
      {sp.imported ? <p className="text-sm text-muted-foreground">Imported {sp.imported} lines.</p> : null}
      {sp.error ? <p className="text-sm text-destructive">{sp.error}</p> : null}

      <div className="rounded-md border">
        <div className="flex items-center justify-between gap-3 border-b p-3">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages} • {projects.length} shown • {total} total
          </div>
          <div className="flex items-center gap-3">
            {prevPage ? (
              <Link className="text-sm underline" href={`/manager/projects?page=${encodeURIComponent(String(prevPage))}`}>
                Prev
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">Prev</span>
            )}
            {nextPage ? (
              <Link className="text-sm underline" href={`/manager/projects?page=${encodeURIComponent(String(nextPage))}`}>
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
              <TableHead>Title</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p: ProjectItem) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <Link className="underline" href={manageTabHref({ edit: p.id, tab: "general", page })}>{p.title}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.language ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(p.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <form
                    action={async () => {
                      "use server";
                      redirect(manageTabHref({ edit: p.id, tab: "general", page }));
                    }}
                  >
                    <Button type="submit" variant="default" size="sm">Manage</Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isCreate ? (
        <Modal
          title="Create project"
          description="General settings"
          closeHref={closeHref}
          widthClassName="max-w-2xl"
        >
          <form
            className="grid gap-3"
            action={async (fd) => {
              "use server";
              const title = fd.get("title");
              const description = fd.get("description");
              const language = fd.get("language");
              await createProject({ title, description, language });
              redirect(`${closeHref}&saved=1`);
            }}
          >
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="c_title">Name</label>
              <Input id="c_title" name="title" required />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="c_language">Languages</label>
              <Input id="c_language" name="language" placeholder="e.g., English" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="c_desc">Description</label>
              <Textarea id="c_desc" name="description" />
            </div>
            <div className="flex items-center justify-end">
              <Button type="submit" variant="secondary">Create</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {editingProject ? (
        <Modal
          title="Manage project"
          description={editingProject.title}
          closeHref={closeHref}
          widthClassName="max-w-7xl"
        >
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            <nav className="space-y-1">
              {tabs.map((t) => {
                const href = manageTabHref({ edit: editingProject.id, tab: t.id, page });
                const isActive = activeTab === t.id;
                return (
                  <Link
                    key={t.id}
                    href={href}
                    className={
                      isActive
                        ? "block rounded-md bg-muted px-3 py-2 text-sm font-medium"
                        : "block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                    }
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-4">
              {activeTab === "general" ? (
                <form
                  className="grid gap-3"
                  action={async (fd) => {
                    "use server";
                    await updateProjectGeneral({
                      projectId: editingProject.id,
                      title: fd.get("title"),
                      description: fd.get("description"),
                      language: fd.get("language"),
                    });
                    redirect(`${manageTabHref({ edit: editingProject.id, tab: "general", page })}&saved=1`);
                  }}
                >
                  <div className="grid gap-1">
                    <label className="text-sm font-medium" htmlFor="p_title">Name</label>
                    <Input id="p_title" name="title" required defaultValue={editingProject.title ?? ""} />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-medium" htmlFor="p_language">Languages</label>
                    <Input id="p_language" name="language" defaultValue={editingProject.language ?? ""} />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-medium" htmlFor="p_desc">Description</label>
                    <Textarea id="p_desc" name="description" defaultValue={editingProject.description ?? ""} />
                  </div>

                  <div className="flex items-center justify-end">
                    <Button type="submit" variant="secondary">Save</Button>
                  </div>
                </form>
              ) : null}

              {activeTab === "access" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Assign agents who can work on this project.</p>
                  <form
                    className="space-y-3"
                    action={async (fd) => {
                      "use server";
                      await requireRole(["MANAGER", "ADMIN"]);

                      const agentIds = fd.getAll("agentIds").map((v) => String(v)).filter(Boolean);
                      await db.$transaction([
                        db.projectAssignment.deleteMany({
                          where: { projectId: editingProject.id, userId: { notIn: agentIds } },
                        }),
                        db.projectAssignment.createMany({
                          data: agentIds.map((userId) => ({ projectId: editingProject.id, userId })),
                          skipDuplicates: true,
                        }),
                      ]);
                      revalidatePath("/manager/projects");
                      revalidatePath("/agent/tasks");
                      redirect(`${manageTabHref({ edit: editingProject.id, tab: "access", page })}&saved=1`);
                    }}
                  >
                    {agentsForAccessTab.length === 0 ? (
                      <p className="text-sm">No agent accounts found.</p>
                    ) : (
                      <ProjectAssignmentsPicker
                        agents={agentsForAccessTab}
                        initialAssignedIds={initialAssignedIdsForAccessTab}
                        projectLanguage={editingProject.language}
                      />
                    )}

                    <div className="flex items-center justify-end">
                      <Button type="submit" variant="secondary">Save Assignments</Button>
                    </div>
                  </form>
                </div>
              ) : null}

              {activeTab === "import" ? (
                <form
                  className="space-y-3"
                  action={async (fd) => {
                    "use server";
                    try {
                      const file = fd.get("file");
                      if (!(file instanceof File)) {
                        redirect(`${manageTabHref({ edit: editingProject.id, tab: "import", page })}&error=${encodeURIComponent("No file selected")}`);
                      }
                      const rawText = await file.text();
                      const res = await importScriptsAnyFormat({
                        projectId: editingProject.id,
                        fileName: file.name,
                        rawText,
                      });
                      redirect(`${manageTabHref({ edit: editingProject.id, tab: "import", page })}&imported=${encodeURIComponent(String(res.inserted))}`);
                    } catch (e) {
                      if (isRedirectError(e)) throw e;
                      const msg = e instanceof Error ? e.message : "Unknown error";
                      redirect(`${manageTabHref({ edit: editingProject.id, tab: "import", page })}&error=${encodeURIComponent(msg)}`);
                    }
                  }}
                >
                  <p className="text-sm text-muted-foreground">Upload CSV/TSV/JSON/JSONL with a text field.</p>
                  <input
                    name="file"
                    type="file"
                    className="block w-full text-sm"
                    accept=".csv,.tsv,.json,.jsonl,text/*,application/json"
                    required
                  />
                  <div className="flex items-center justify-end">
                    <Button type="submit" variant="secondary">Import</Button>
                  </div>
                </form>
              ) : null}

              {activeTab === "advanced" ? (
                <form
                  className="grid gap-3"
                  action={async (fd) => {
                    "use server";
                    await updateProjectAdvanced({
                      projectId: editingProject.id,
                      targetMos: fd.get("targetMos"),
                      nisqaMinScore: fd.get("nisqaMinScore"),
                    });
                    redirect(`${manageTabHref({ edit: editingProject.id, tab: "advanced", page })}&saved=1`);
                  }}
                >
                  <div className="grid gap-1">
                    <label className="text-sm font-medium" htmlFor="adv_mos">Target MOS</label>
                    <Input
                      id="adv_mos"
                      name="targetMos"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      required
                      defaultValue={String(editingProject.targetMos ?? 3.5)}
                    />
                    <div className="text-xs text-muted-foreground">Minimum MOS score for auto-pass.</div>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium" htmlFor="adv_nisqa">NISQA min score</label>
                    <Input
                      id="adv_nisqa"
                      name="nisqaMinScore"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      required
                      defaultValue={String(editingProject.nisqaMinScore ?? 3.5)}
                    />
                    <div className="text-xs text-muted-foreground">Threshold for mean NISQA (NOI/DIS/COL/LOUD).</div>
                  </div>
                  <div className="flex items-center justify-end">
                    <Button type="submit" variant="secondary">Save</Button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
