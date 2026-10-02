"use client";

import { IconAlertTriangle, IconCalendarX, IconClock, IconDots, IconRefresh } from "@tabler/icons-react";
import type { EventContentArg } from "@fullcalendar/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type RemoveBlockFn = (timeBlockId: string, taskId: string) => void;

type EventProps =
  | {
      kind: "block";
      taskId: string;
      color: string;
      completed: boolean;
      syncState: "PENDING" | "SYNCED" | "ERROR";
      lastSyncError: string | null;
    }
  | { kind: "due"; taskId: string; color: string }
  | { kind: "google"; htmlLink: string | null };

/**
 * Custom event rendering (10.1): my blocks with a project-color bar and a hover ⋯ menu, date-only
 * due dates as chips. FullCalendar portals this into its tree, so it's a normal React subtree.
 */
export function EventContent({
  arg,
  onRemove,
  onRetry,
  connected,
}: {
  arg: EventContentArg;
  onRemove: RemoveBlockFn;
  onRetry: RemoveBlockFn;
  /** Google Calendar is connected: show each block's sync state (10.1). */
  connected: boolean;
}) {
  const props = arg.event.extendedProps as EventProps;
  if (props.kind === "due") {
    return <DueChip title={arg.event.title} color={props.color} />;
  }
  if (props.kind === "google") {
    return <GoogleEvent arg={arg} />;
  }
  const start = arg.event.start;
  const end = arg.event.end;
  // A time range fits under the title from ~45 minutes up (48px per hour); month cells don't.
  const minutes = start && end ? (end.getTime() - start.getTime()) / 60_000 : 0;
  const showTime = arg.view.type !== "dayGridMonth" && minutes >= 45;
  return (
    <div
      className="group/blk relative h-full w-full overflow-hidden rounded-[5px] px-1.5 py-0.5"
      style={{ background: `color-mix(in oklab, ${props.color} 14%, var(--background))` }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: props.color }} />
      <div
        className={cn(
          "flex items-center gap-1 pr-4 text-[12px] font-medium leading-4",
          props.completed ? "text-muted-foreground line-through" : "text-foreground",
        )}
      >
        {connected && <SyncIcon state={props.syncState} error={props.lastSyncError} />}
        <span className="truncate">{arg.event.title}</span>
      </div>
      {showTime && start && end && (
        <div className={cn("text-[11px] leading-[14px] text-muted-foreground", props.completed && "line-through")}>
          {formatClock(start)}–{formatClock(end)}
        </div>
      )}
      <BlockMenu
        timeBlockId={arg.event.id}
        taskId={props.taskId}
        onRemove={onRemove}
        onRetry={connected && props.syncState === "ERROR" ? onRetry : undefined}
      />
    </div>
  );
}

/** One of my other Google events: light gray, read-only (10.1). */
function GoogleEvent({ arg }: { arg: EventContentArg }) {
  const start = arg.event.start;
  const end = arg.event.end;
  const minutes = start && end ? (end.getTime() - start.getTime()) / 60_000 : 0;
  const showTime = !arg.event.allDay && arg.view.type !== "dayGridMonth" && minutes >= 45;
  return (
    <div
      title={`${arg.event.title} (Google Calendar)`}
      className="h-full w-full overflow-hidden rounded-[5px] bg-pill px-1.5 py-0.5 text-muted-foreground"
    >
      <div className="truncate text-[12px] font-medium leading-4">{arg.event.title}</div>
      {showTime && start && end && (
        <div className="text-[11px] leading-[14px]">
          {formatClock(start)}–{formatClock(end)}
        </div>
      )}
    </div>
  );
}

function DueChip({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1 rounded bg-pill px-1.5 text-[11px] leading-4">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 truncate">{title}</span>
    </div>
  );
}

/** Nothing when synced; a clock while pushing; a warning (hover: the error) when it failed. */
function SyncIcon({ state, error }: { state: "PENDING" | "SYNCED" | "ERROR"; error: string | null }) {
  if (state === "PENDING") return <IconClock aria-label="Syncing to Google Calendar" className="size-3 shrink-0 text-muted-foreground" />;
  if (state === "ERROR")
    return (
      <span title={error ?? "Google Calendar sync failed"} className="shrink-0">
        <IconAlertTriangle aria-label="Google Calendar sync failed" className="size-3 text-overdue" />
      </span>
    );
  return null;
}

function BlockMenu({
  timeBlockId,
  taskId,
  onRemove,
  onRetry,
}: {
  timeBlockId: string;
  taskId: string;
  onRemove: RemoveBlockFn;
  /** Set for an ERROR block: "Retry sync". */
  onRetry?: RemoveBlockFn;
}) {
  // No native stopPropagation here: React handles the trigger at the root, above FullCalendar's
  // listeners, so stopping the event would also stop the menu. A click doesn't move the pointer,
  // so FullCalendar never starts a drag from it; eventClick skips [data-block-menu] targets.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            data-block-menu
            aria-label="Time block actions"
            className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded text-foreground/50 opacity-0 hover:bg-background/50 hover:text-foreground focus-visible:opacity-100 group-hover/blk:opacity-100"
          />
        }
      >
        <IconDots className="size-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {onRetry && (
          <DropdownMenuItem onClick={() => onRetry(timeBlockId, taskId)}>
            <IconRefresh aria-hidden />
            Retry sync
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onRemove(timeBlockId, taskId)}>
          <IconCalendarX aria-hidden />
          Remove from calendar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Same clock style as the dialog's Scheduled rows ("10:45–12:00"). */
function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
