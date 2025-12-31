import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ManagerHomePage() {
  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
        <p className="text-muted-foreground">
          Create projects, assign agents, review submissions, and export recordings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Create projects, import scripts, assign agents.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/manager/projects"
              className={cn(buttonVariants({ variant: "default" }), "w-full")}
            >
              Manage Projects
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Manual Review</CardTitle>
            <CardDescription>Approve or reject flagged/pending submissions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/manager/review"
              className={cn(buttonVariants({ variant: "default" }), "w-full")}
            >
              Open Review Queue
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Recordings Log</CardTitle>
            <CardDescription>Browse recordings with metadata + audio playback.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/manager/recordings"
              className={cn(buttonVariants({ variant: "default" }), "w-full")}
            >
              View Recordings
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>Contribution metrics per agent.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/manager/performance"
              className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
            >
              View Agent Metrics
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>View accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/manager/users"
              className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
            >
              Manage Users
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
