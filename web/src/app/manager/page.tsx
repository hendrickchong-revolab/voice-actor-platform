import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ManagerHomePage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Manager</h1>
        <p className="text-sm text-muted-foreground">
          Create projects, assign agents, review submissions, and export recordings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Create projects, import scripts, assign agents.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="underline" href="/manager/projects">
              Open projects
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual review</CardTitle>
            <CardDescription>Approve or reject flagged/pending submissions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="underline" href="/manager/review">
              Open review queue
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recordings log</CardTitle>
            <CardDescription>Browse recordings with metadata + audio playback.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="underline" href="/manager/recordings">
              Open recordings log
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>Contribution metrics per agent.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="underline" href="/manager/performance">
              View agent metrics
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>View accounts (Admins can update roles and add users).</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="underline" href="/manager/users">
              Manage users
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
