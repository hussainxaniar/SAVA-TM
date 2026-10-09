"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconBell } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useMarkAllRead,
  useMarkRead,
  useNotificationList,
  useUnreadCount,
} from "@/hooks/use-notifications";
import { notificationHref } from "@/lib/notification-format";
import type { NotificationDTO } from "@/server/services/types";
import { NotificationList } from "./notification-list";

/*
 * The sidebar bell (16.4). The trigger carries the unread badge (polled every 30 s and on window
 * focus); the popover loads its list only while open. Opening a row navigates to the task, marks
 * it read and closes. Base UI closes the popover on Esc and its popup role keeps the global
 * shortcuts (9.7) standing down, so no key handling here.
 */

export function NotificationBell({ spaceId }: { spaceId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: unread } = useUnreadCount(spaceId);
  const list = useNotificationList(spaceId, open);
  const markRead = useMarkRead(spaceId);
  const markAllRead = useMarkAllRead(spaceId);

  const count = unread ?? 0;
  const items = list.data ?? [];

  function openNotification(n: NotificationDTO) {
    router.push(notificationHref(spaceId, n));
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        className="relative flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <IconBell className="size-[18px]" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex h-11 items-center gap-1 border-b border-border px-3">
          <p className="grow text-sm font-semibold">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0 || items.length === 0}
            onClick={() => markAllRead.mutate()}
          >
            Mark all as read
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {list.isLoading ? (
            <div className="flex flex-col gap-3 p-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {"You're all caught up"}
            </p>
          ) : (
            <NotificationList spaceId={spaceId} items={items} onOpen={openNotification} />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
