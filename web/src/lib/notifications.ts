import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type NotificationDelegate = {
  create: (args: {
    data: {
      userId: string;
      type: string;
      title: string;
      message: string;
      payload?: Prisma.InputJsonValue;
    };
  }) => Promise<unknown>;
  findMany: (args: {
    where: { userId: string };
    orderBy: { createdAt: "desc" };
    take: number;
    select: {
      id: true;
      type: true;
      title: true;
      message: true;
      payload: true;
      readAt: true;
      createdAt: true;
    };
  }) => Promise<
    Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      payload: Prisma.JsonValue | null;
      readAt: Date | null;
      createdAt: Date;
    }>
  >;
  count: (args: { where: { userId: string; readAt: null } }) => Promise<number>;
  updateMany: (args: { where: { userId: string; readAt: null }; data: { readAt: Date } }) => Promise<unknown>;
};

export type NotificationListItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
};

function getNotificationDelegate() {
  return (db as unknown as { notification?: NotificationDelegate }).notification ?? null;
}

export async function createUserNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  payload?: Prisma.InputJsonValue;
}) {
  const { userId, type, title, message, payload } = input;

  const notification = getNotificationDelegate();
  if (!notification) {
    const payloadJson = payload == null ? null : JSON.stringify(payload);
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    await db.$executeRaw(
      Prisma.sql`INSERT INTO "Notification" ("id", "userId", "type", "title", "message", "payload")
                 VALUES (${id}, ${userId}, ${type}, ${title}, ${message}, CAST(${payloadJson} AS jsonb))`,
    );
    return { id };
  }

  return notification.create({
    data: {
      userId,
      type,
      title,
      message,
      payload: payload ?? undefined,
    },
  });
}

export async function listUserNotifications(userId: string): Promise<{
  items: NotificationListItem[];
  unreadCount: number;
}> {
  const notification = getNotificationDelegate();
  if (notification) {
    const [items, unreadCount] = await Promise.all([
      notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          payload: true,
          readAt: true,
          createdAt: true,
        },
      }),
      notification.count({ where: { userId, readAt: null } }),
    ]);

    return { items, unreadCount };
  }

  const [items, unread] = await Promise.all([
    db.$queryRaw<NotificationListItem[]>(
      Prisma.sql`SELECT "id", "type", "title", "message", "payload", "readAt", "createdAt"
                 FROM "Notification"
                 WHERE "userId" = ${userId}
                 ORDER BY "createdAt" DESC
                 LIMIT 20`,
    ),
    db.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`SELECT COUNT(*)::int AS count
                 FROM "Notification"
                 WHERE "userId" = ${userId} AND "readAt" IS NULL`,
    ),
  ]);

  return {
    items,
    unreadCount: unread[0]?.count ?? 0,
  };
}

export async function markAllUserNotificationsRead(userId: string) {
  const notification = getNotificationDelegate();
  if (notification) {
    await notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return;
  }

  await db.$executeRaw(
    Prisma.sql`UPDATE "Notification"
               SET "readAt" = NOW()
               WHERE "userId" = ${userId} AND "readAt" IS NULL`,
  );
}
