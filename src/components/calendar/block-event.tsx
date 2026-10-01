"use client";

import { IconCalendarX, IconDots } from "@tabler/icons-react";
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
  | { kind: "block"; taskId: string; color: string; completed: boolean }
  | { kind: "due"; taskId: string; color: string };

/**
 * Custom event rendering (10.1): my blocks with a project-color bar and a hover ⋯ menu, date-only
 * due dates as chips. FullCalendar portals this into its tree, so it's a normal React subtree.
 */
export function EventContent({ arg, onRemove }: { arg: EventContentArg; onRemove: RemoveBlockFn }) {
  const props = arg.event.extendedProps as EventProps;
  if (props.kind === "due") {
    return <DueChip title={arg.event.title} color={props.color} />;
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
          "truncate pr-4 text-[12px] font-medium leading-4",
          props.completed ? "text-muted-foreground line-through" : "text-foreground",
        )}
      >
        {arg.event.title}
      </div>
      {showTime && start && end && (
        <div className={cn("text-[11px] leading-[14px] text-muted-foreground", props.completed && "line-through")}>
          {formatClock(start)}–{formatClock(end)}
        </div>
      )}
      <BlockMenu timeBlockId={arg.event.id} taskId={props.taskId} onRemove={onRemove} />
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

function BlockMenu({
  timeBlockId,
  taskId,
  onRemove,
}: {
  timeBlockId: string;
  taskId: string;
  onRemove: RemoveBlockFn;
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
