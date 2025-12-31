import { createProject, listActiveProjects } from "@/actions/projects";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function ManagerProjectsPage() {
  const projects = await listActiveProjects();
  type ProjectItem = Awaited<ReturnType<typeof listActiveProjects>>[number];

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            action={async (formData) => {
              "use server";
              await createProject({
                title: formData.get("title"),
                description: formData.get("description"),
                language: formData.get("language"),
              });

              // Force a fresh server render so the new project appears immediately.
              redirect("/manager/projects");
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="title" placeholder="Title" required />
              <div className="space-y-1">
                <Input name="language" placeholder="Language (optional)" />
                <div className="text-xs text-muted-foreground">Leave blank if unknown.</div>
              </div>
            </div>
            <Textarea name="description" placeholder="Description" />

            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Language</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p: ProjectItem) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link className="underline" href={`/manager/projects/${p.id}`}>
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.language ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
