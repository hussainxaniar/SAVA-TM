"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getUnreadCountAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notifications";
import type { NotificationDTO } from "@/server/services/types";
import { unwrap } from "./use-list-view";

/*
 * The notification bell (Section 16). Two queries per space under ['notifications', spaceId]:
 * the unread count, polled every 30 s and when the window regains focus (this is the badge), and
 * the list, fetched only while the popover is open. Marking read patches both caches at once and
 * rolls back with an error toast.
 */

export const POLL_MS = 30_000;

export const notificationsKey = (spaceId: string) => ["notifications", spaceId] as const;
const countKey = (spaceId: string) => [...notificationsKey(spaceId), "count"] as const;
const listKey = (spaceId: string) => [...notificationsKey(spaceId), "list"] as const;

export function useUnreadCount(spaceId: string) {
  return useQuery({
    queryKey: countKey(spaceId),
    queryFn: async () => unwrap(await getUnreadCountAction({ spaceId })),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** The 30 newest notifications; pass `open` so the list loads only while the popover is shown. */
export function useNotificationList(spaceId: string, open: boolean) {
  return useQuery({
    queryKey: listKey(spaceId),
    queryFn: async () => unwrap(await listNotificationsAction({ spaceId })),
    enabled: open,
    refetchOnMount: "always",
  });
}

/** Marks one notification read (the row stays in the list, its unread dot goes). */
export function useMarkRead(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => unwrap(await markNotificationReadAction({ notificationId })),
    onMutate: async (notificationId) => {
      await qc.cancelQueries({ queryKey: notificationsKey(spaceId) });
      const prevList = qc.getQueryData<NotificationDTO[]>(listKey(spaceId));
      const prevCount = qc.getQueryData<number>(countKey(spaceId));
      const wasUnread = prevList?.some((n) => n.id === notificationId && !n.readAt) ?? false;
      const now = new Date().toISOString();
      if (prevList) qc.setQueryData<NotificationDTO[]>(listKey(spaceId), prevList.map((n) => (n.id === notificationId && !n.readAt ? { ...n, readAt: now } : n)));
      if (wasUnread && prevCount !== undefined) qc.setQueryData<number>(countKey(spaceId), Math.max(prevCount - 1, 0));
      return { prevList, prevCount };
    },
    onError: (error, _id, context) => {
      qc.setQueryData(listKey(spaceId), context?.prevList);
      qc.setQueryData(countKey(spaceId), context?.prevCount);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: notificationsKey(spaceId) }),
  });
}

/** "Mark all as read": clears the badge and every unread dot. */
export function useMarkAllRead(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await markAllNotificationsReadAction({ spaceId })),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationsKey(spaceId) });
      const prevList = qc.getQueryData<NotificationDTO[]>(listKey(spaceId));
      const prevCount = qc.getQueryData<number>(countKey(spaceId));
      const now = new Date().toISOString();
      if (prevList) qc.setQueryData<NotificationDTO[]>(listKey(spaceId), prevList.map((n) => (n.readAt ? n : { ...n, readAt: now })));
      qc.setQueryData<number>(countKey(spaceId), 0);
      return { prevList, prevCount };
    },
    onError: (error, _v, context) => {
      qc.setQueryData(listKey(spaceId), context?.prevList);
      qc.setQueryData(countKey(spaceId), context?.prevCount);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: notificationsKey(spaceId) }),
  });
}
