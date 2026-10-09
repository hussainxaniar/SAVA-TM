"use client";

import { Avatar } from "@/components/tasks/avatar-stack";
import { relativeTime } from "@/lib/activity-format";
import { notificationParts } from "@/lib/notification-format";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/server/services/types";

/*
 * The rows of the notification popover (16.4). One button per notification: avatar, the sentence
 * "<actor> <before> <task title><after>" and a relative time, with an unread dot on the right.
 * Clicking calls `onOpen`; the bell navigates, marks read and closes.
 */

type Props = {
  spaceId: string;
  items: NotificationDTO[];
  onOpen: (notification: NotificationDTO) => void;
};

/** First word of a name ("Maryam Reyes" → "Maryam"). */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function NotificationList({ items, onOpen }: Props) {
  return (
    <div className="divide-y divide-border">
      {items.map((n) => (
        <Row key={n.id} notification={n} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Row({
  notification: n,
  onOpen,
}: {
  notification: NotificationDTO;
  onOpen: Props["onOpen"];
}) {
  const parts = notificationParts(n);
  const read = n.readAt !== null;
  const emphasis = read ? "font-medium" : "font-medium text-foreground";
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-accent"
    >
      <Avatar user={n.actor} className="size-7 text-[11px]" />
      <div className="min-w-0 grow">
        <p className={cn("line-clamp-3 text-[13px] leading-[18px]", read ? "text-muted-foreground" : "text-foreground/75")}>
          <span className={emphasis}>{firstName(n.actor.name)}</span> {parts.before}{" "}
          <span className={emphasis}>{n.task.title}</span>
          {parts.after}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(n.createdAt)}</p>
      </div>
      {!read && <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
    </button>
  );
}
