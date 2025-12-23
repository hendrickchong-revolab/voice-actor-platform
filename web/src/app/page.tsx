import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";

export default async function Home() {
  const session = await requireSession();

  if (session.user.role === "ADMIN" || session.user.role === "MANAGER") {
    redirect("/manager");
  }

  redirect("/agent");
}
