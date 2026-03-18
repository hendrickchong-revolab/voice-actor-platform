"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function UserLanguagesCell({
  userEmail,
  languages,
}: {
  userEmail: string;
  languages: string[];
}) {
  const [open, setOpen] = useState(false);

  const normalized = useMemo(
    () => languages.map((l) => l.trim()).filter(Boolean),
    [languages],
  );

  const visible = normalized.slice(0, 2);
  const hiddenCount = Math.max(0, normalized.length - visible.length);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`View all languages for ${userEmail}`}
        title="View all languages"
      >
        {normalized.length ? (
          <div className="flex flex-wrap gap-1.5 text-left">
            {visible.map((lang) => (
              <Badge key={`${userEmail}_${lang}`} variant="secondary">
                {lang}
              </Badge>
            ))}
            {hiddenCount > 0 ? <Badge variant="outline">+{hiddenCount}</Badge> : null}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground underline">—</span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Languages</DialogTitle>
            <DialogDescription>{userEmail}</DialogDescription>
          </DialogHeader>

          {normalized.length ? (
            <ul className="max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
              {normalized.map((lang) => (
                <li key={`${userEmail}_modal_${lang}`}>{lang}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No languages set.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
