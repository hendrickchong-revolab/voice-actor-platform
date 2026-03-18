import { redirect } from "next/navigation";

export default async function ManagerProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/manager/projects?page=1&tab=general&edit=${encodeURIComponent(projectId)}`);
}
