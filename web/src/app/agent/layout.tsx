import { requireRole } from "@/lib/session";

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["AGENT", "ADMIN"]);
  return children;
}
