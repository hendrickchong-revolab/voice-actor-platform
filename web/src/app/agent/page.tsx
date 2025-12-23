import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AgentHomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Agent</h1>
        <p className="text-sm text-muted-foreground">
          Record your assigned lines and track your contribution metrics.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recording session</CardTitle>
            <CardDescription>Select a project and start recording.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="underline" href="/agent/tasks">
              Start tasks
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>See your total duration and count.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="underline" href="/agent/performance">
              View my performance
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Update your username or password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="underline" href="/account">
              Open account
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
