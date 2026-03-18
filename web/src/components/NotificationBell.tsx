"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  payload?: {
    href?: string;
    pendingRejectedCount?: number;
    [key: string]: unknown;
  } | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { items: NotificationItem[]; unreadCount: number };
      setItems(json.items);
      setUnreadCount(json.unreadCount);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    const res = await fetch("/api/notifications", { method: "POST" });
    if (!res.ok) return;
    await loadNotifications();
  }

  useEffect(() => {
    void loadNotifications();
    const t = window.setInterval(() => {
      void loadNotifications();
    }, 30000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="relative"
        aria-label="Notifications"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            void loadNotifications();
          }
        }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <Badge variant="destructive" className="absolute -right-2 -top-2 h-5 min-w-5 px-1 text-[10px]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-background p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Notifications</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          </div>

          {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}

          {!loading && items.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notifications yet.</p>
          ) : null}

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {items.map((n) => (
              n.payload?.href ? (
                <Link
                  key={n.id}
                  href={n.payload.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md border p-2 transition-colors hover:bg-muted/40"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{n.title}</p>
                    {n.readAt ? null : <Badge variant="secondary">new</Badge>}
                  </div>
                  <p className="whitespace-pre-line text-xs text-muted-foreground">{n.message}</p>
                </Link>
              ) : (
                <div key={n.id} className="rounded-md border p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{n.title}</p>
                    {n.readAt ? null : <Badge variant="secondary">new</Badge>}
                  </div>
                  <p className="whitespace-pre-line text-xs text-muted-foreground">{n.message}</p>
                </div>
              )
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
