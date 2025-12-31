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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-16">
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link 
              className="text-lg font-semibold text-foreground hover:opacity-80 transition-opacity" 
              href="/"
            >
              VA Platform
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {isAgent ? (
                <Link 
                  className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" 
                  href="/agent"
                >
                  Agent
                </Link>
              ) : null}
              {isManager ? (
                <>
                  <Link 
                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" 
                    href="/manager"
                  >
                    Manager
                  </Link>
                  <Link 
                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" 
                    href="/manager/projects"
                  >
                    Projects
                  </Link>
                  <Link 
                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" 
                    href="/manager/recordings"
                  >
                    Recordings
                  </Link>
                  <Link 
                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" 
                    href="/manager/users"
                  >
                    Users
                  </Link>
                </>
              ) : null}
            </div>
          </nav>

          <AuthStatus email={session?.user?.email} role={role} />
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </div>
    </div>
  );
}
