import { requireRole } from "@/lib/session";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["MANAGER", "ADMIN"]);
  return children;
}
