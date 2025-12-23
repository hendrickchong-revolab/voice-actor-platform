import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { AuthStatus } from "@/components/AuthStatus";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  const isAgent = role === "AGENT" || role === "ADMIN";
  const isManager = role === "MANAGER" || role === "ADMIN";

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 p-4">
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link className="font-medium" href="/">
              VA Platform
            </Link>
            {isAgent ? (
              <Link className="text-muted-foreground hover:text-foreground" href="/agent">
                Agent
              </Link>
            ) : null}
            {isManager ? (
              <Link className="text-muted-foreground hover:text-foreground" href="/manager">
                Manager
              </Link>
            ) : null}
            {isManager ? (
              <Link className="text-muted-foreground hover:text-foreground" href="/manager/recordings">
                Log
              </Link>
            ) : null}
            {isManager ? (
              <Link className="text-muted-foreground hover:text-foreground" href="/manager/users">
                Users
              </Link>
            ) : null}
          </nav>

          <AuthStatus email={session?.user?.email} role={role} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </div>
  );
}
