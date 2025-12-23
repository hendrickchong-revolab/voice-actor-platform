import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AgentTaskRunner } from "@/components/AgentTaskRunner";
import { requireSession } from "@/lib/session";
import { getNextTaskForAgent } from "@/lib/agentTasks";

export const dynamic = "force-dynamic";

export default async function AgentTaskRunnerPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireSession();
  let initial;
  try {
    initial = await getNextTaskForAgent({
      projectId,
      userId: session.user.id,
      role: session.user.role,
    });
  } catch {
    redirect("/unauthorized");
  }

  return (
    <main className="space-y-6">
      <div>
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/agent/tasks">
          ← Projects
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentTaskRunner projectId={projectId} initial={initial} />
        </CardContent>
      </Card>
    </main>
  );
}
