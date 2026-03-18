import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AgentHomePage() {
  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
        <p className="text-muted-foreground">
          Record your assigned lines and track your contribution metrics.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Recording Session</CardTitle>
            <CardDescription>Select a project and start recording tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/agent/tasks"
              className={cn(buttonVariants({ variant: "default" }), "w-full")}
            >
              Start Tasks
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>See your total duration and recording count.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/agent/performance"
              className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
            >
              View My Performance
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Rejected Tasks</CardTitle>
            <CardDescription>Review and re-record tasks rejected by QC.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/agent/rejected-tasks"
              className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
            >
              Review Rejected Tasks
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Update your username or password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/account"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Account Settings
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
