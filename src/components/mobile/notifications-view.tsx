"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevronLeft } from "@tabler/icons-react";
import { Avatar } from "@/components/tasks/avatar-stack";
import { useMarkAllRead, useMarkRead, useNotificationList } from "@/hooks/use-notifications";
import { relativeTime } from "@/lib/activity-format";
import { notificationHref, notificationParts } from "@/lib/notification-format";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/server/services/types";

/**
 * The notifications screen on a phone (M-06, docs/design/mobile 11): the bell's popover as a
 * full page. Rows open the task (same `?task=` dialog) and mark themselves read; the header
 * marks everything read.
 */
export function NotificationsView({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const list = useNotificationList(spaceId, true);
  const markRead = useMarkRead(spaceId);
  const markAllRead = useMarkAllRead(spaceId);

  const items = list.data ?? [];
  const unreadCount = items.filter((n) => !n.readAt).length;

  function openNotification(n: NotificationDTO) {
    if (!n.readAt) markRead.mutate(n.id);
    router.push(notificationHref(spaceId, n));
  }

  return (
    <div>
      <header className="flex h-11 items-center pl-1 pr-3">
        <Link href={`/s/${spaceId}/more`} className="flex items-center gap-0.5 pl-1.5 pr-2 text-base text-primary">
          <IconChevronLeft aria-hidden className="size-6" />
          More
        </Link>
        <span className="min-w-0 flex-1" />
        <button
          type="button"
          disabled={unreadCount === 0}
          onClick={() => markAllRead.mutate()}
          className="text-[15px] font-medium text-primary disabled:text-faint"
        >
          Mark all read
        </button>
      </header>
      <h1 className="border-b border-border px-4 pb-3 pt-1 text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-foreground">
        Notifications
      </h1>
      {list.isLoading ? (
        <SkeletonRows />
      ) : items.length === 0 ? (
        <p className="pt-16 text-center text-[15px] text-muted-foreground">You&apos;re all caught up</p>
      ) : (
        items.map((n) => <Row key={n.id} notification={n} onOpen={openNotification} />)
      )}
    </div>
  );
}

/** First word of a name ("Maryam Reyes" → "Maryam"). Same rule as the desktop list. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function Row({
  notification: n,
  onOpen,
}: {
  notification: NotificationDTO;
  onOpen: (n: NotificationDTO) => void;
}) {
  const parts = notificationParts(n);
  const read = n.readAt !== null;
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className="flex w-full items-start gap-2.5 border-b border-divider py-3 pl-2 pr-4 text-left"
    >
      <span aria-hidden className="flex h-8 w-2 items-center">
        {!read && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <Avatar user={n.actor} className="size-8 shrink-0 text-xs" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn("line-clamp-3 text-[15px] leading-5", read ? "text-body" : "font-medium text-foreground")}
        >
          {firstName(n.actor.name)} {parts.before} {n.task.title}
          {parts.after}
        </span>
        <span className="text-xs leading-4 text-muted-foreground">{relativeTime(n.createdAt)}</span>
      </span>
    </button>
  );
}

/** Three skeleton rows while the list loads (no spinner, per docs/design/mobile.md). */
function SkeletonRows() {
  return (
    <div aria-hidden className="animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-2.5 border-b border-divider py-3 pl-2 pr-4">
          <span className="h-8 w-2" />
          <span className="size-8 shrink-0 rounded-full bg-pill" />
          <span className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
            <span className="h-4 w-3/5 rounded-md bg-pill" />
            <span className="h-3 w-1/4 rounded-md bg-pill" />
          </span>
        </div>
      ))}
    </div>
  );
}
