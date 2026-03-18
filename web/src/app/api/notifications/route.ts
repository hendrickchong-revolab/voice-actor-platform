import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { listUserNotifications, markAllUserNotificationsRead } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const { items, unreadCount } = await listUserNotifications(session.user.id);

  return NextResponse.json({ items, unreadCount });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  await markAllUserNotificationsRead(session.user.id);

  return NextResponse.json({ ok: true });
}
