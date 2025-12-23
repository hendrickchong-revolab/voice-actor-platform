"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DeleteUserButton({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const ok = window.confirm(`Delete user ${label}? This cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const msg = await res.text();
        window.alert(msg || "Delete failed.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="destructive" onClick={onDelete} disabled={busy}>
      {busy ? "Deleting…" : "Delete"}
    </Button>
  );
}
