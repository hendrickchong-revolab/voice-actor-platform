import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AgentRejectedTaskRunner } from "@/components/AgentRejectedTaskRunner";
import { requireSession } from "@/lib/session";
import { getNextRejectedTaskForAgent } from "@/lib/rejectedTasks";

export const dynamic = "force-dynamic";

export default async function AgentRejectedTaskRunnerPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireSession();
  let initial;

  try {
    initial = await getNextRejectedTaskForAgent({
      projectId,
      userId: session.user.id,
      role: session.user.role,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === "UNAUTHORIZED_PROJECT") {
      redirect("/unauthorized");
    }
    throw e;
  }

  return (
    <main className="space-y-6">
      <div>
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/agent/rejected-tasks">
          ← Rejected Projects
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rejected Task Review</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentRejectedTaskRunner projectId={projectId} initial={initial} />
        </CardContent>
      </Card>
    </main>
  );
}
