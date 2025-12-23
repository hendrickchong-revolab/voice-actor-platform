import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentSessionPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  await searchParams;
  redirect("/agent/tasks");
}
