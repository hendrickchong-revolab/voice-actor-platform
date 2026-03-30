"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateUserCredentialsAsAdmin } from "@/actions/users";

export function EditUserCredentialsButton({
  userId,
  username,
  returnTo,
}: {
  userId: string;
  username: string | null;
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Edit Login Credentials
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit login credentials</DialogTitle>
            <DialogDescription>
              For security, confirm your own password first. Then you can update the user&apos;s username and set a new password.
            </DialogDescription>
          </DialogHeader>

          <form action={updateUserCredentialsAsAdmin} className="space-y-4">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor={`admin_pw_${userId}`}>
                Your admin password
              </label>
              <Input id={`admin_pw_${userId}`} name="adminPassword" type="password" autoComplete="current-password" required />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor={`username_${userId}`}>
                Username
              </label>
              <Input
                id={`username_${userId}`}
                name="username"
                defaultValue={username ?? ""}
                autoComplete="off"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor={`new_pw_${userId}`}>
                New password
              </label>
              <Input id={`new_pw_${userId}`} name="newPassword" type="password" autoComplete="new-password" required />
              <div className="text-xs text-muted-foreground">The old password is never shown. Set a new one.</div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor={`confirm_pw_${userId}`}>
                Confirm new password
              </label>
              <Input id={`confirm_pw_${userId}`} name="confirmPassword" type="password" autoComplete="new-password" required />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton>Save credentials</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}


