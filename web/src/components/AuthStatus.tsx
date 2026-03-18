"use client";

import { signOut } from "next-auth/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";

export function AuthStatus({
  email,
  role,
}: {
  email?: string | null;
  role?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      {email ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{email}</span>
          {role ? <Badge variant="secondary">{role}</Badge> : null}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Not signed in</span>
      )}

      {email ? (
        <NotificationBell />
      ) : null}

      {email ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Logout
        </Button>
      ) : null}
    </div>
  );
}
