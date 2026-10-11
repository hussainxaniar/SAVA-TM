"use client";

import { useCallback, useMemo, type RefObject } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DatesSetArg,
  DayHeaderContentArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { DropArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import {
  useCreateTimeBlock,
  useDeleteTimeBlock,
  useDueChips,
  useGoogleConnection,
  useGoogleEvents,
  useRetrySync,
  useTimeBlocks,
  useUpdateTimeBlock,
  type Range,
} from "@/hooks/use-calendar";
import { toast } from "sonner";
import { TASK_LONG_PRESS_MS } from "@/hooks/use-task-drag-source";
import { cn } from "@/lib/utils";
import { EventContent, type RemoveBlockFn } from "./block-event";

/** What the phone's block detail sheet shows (a tap on one of my blocks). */
export type BlockTap = {
  timeBlockId: string;
  taskId: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  completed: boolean;
  syncState: "PENDING" | "SYNCED" | "ERROR";
  lastSyncError: string | null;
};

/** The phone's default view: three days from the current date (docs/design/mobile.md, Calendar). */
export const THREE_DAY_VIEW = "timeGridThreeDay";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Phone day header: the weekday over the day number, today in a filled circle. */
function PhoneDayHeader({ arg }: { arg: DayHeaderContentArg }) {
  return (
    <span className="flex flex-col items-center gap-0.5 py-1.5">
      <span
        className={cn(
          "text-[11px] font-semibold leading-[14px] tracking-[0.04em]",
          arg.isToday ? "text-primary" : "text-muted-foreground",
        )}
      >
        {WEEKDAYS[arg.date.getDay()]}
      </span>
      <span
        className={cn(
          "flex size-[30px] items-center justify-center rounded-full text-base leading-[22px]",
          arg.isToday ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-foreground",
        )}
      >
        {arg.date.getDate()}
      </span>
    </span>
  );
}

function scheduledLabel(start: Date, end: Date): string {
  const day = start.toLocaleDateString(undefined, { weekday: "short" });
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Scheduled ${day}, ${time(start)}–${time(end)}`;
}

type CalendarGridProps = {
  spaceId: string;
  range: Range | null;
  calendarRef: RefObject<FullCalendar | null>;
  onDatesSet: (arg: DatesSetArg) => void;
  onOpenTask: (taskId: string) => void;
  /**
   * Phone layout: the 3-day view, long-press dragging, no hover menu on blocks, a tap on a block
   * calls `onBlockTap` instead of opening the task, and a drop shows a toast with Undo.
   */
  mobile?: boolean;
  onBlockTap?: (block: BlockTap) => void;
};

/**
 * The FullCalendar grid (10.1). Blocks come from ['calendar', spaceId, 'blocks'], date-only due
 * dates render as all-day chips. Every option the grid needs is named in docs/tickets/T-17.md §3.
 */
export function CalendarGrid({ spaceId, range, calendarRef, onDatesSet, onOpenTask, mobile = false, onBlockTap }: CalendarGridProps) {
  const blocks = useTimeBlocks(spaceId, range);
  const dueChips = useDueChips(spaceId, range);
  const createTimeBlock = useCreateTimeBlock(spaceId);
  const updateTimeBlock = useUpdateTimeBlock(spaceId);
  const deleteTimeBlock = useDeleteTimeBlock(spaceId);
  const retrySync = useRetrySync(spaceId);
  const connected = useGoogleConnection().data?.connected ?? false;
  const googleEvents = useGoogleEvents(spaceId, range, connected);

  const events = useMemo<EventInput[]>(() => {
    const list: EventInput[] = [];
    for (const block of blocks.data ?? []) {
      list.push({
        id: block.id,
        title: block.taskTitle,
        start: block.start,
        end: block.end,
        editable: !block.id.startsWith("temp-"),
        extendedProps: {
          kind: "block",
          taskId: block.taskId,
          color: block.projectColor,
          completed: block.completed,
          syncState: block.syncState,
          lastSyncError: block.lastSyncError,
        },
      });
    }
    // Other Google events: gray, read-only, click opens Google (10.4).
    for (const ev of googleEvents.data?.events ?? []) {
      list.push({
        id: `google-${ev.id}`,
        title: ev.title,
        start: ev.start,
        end: ev.end,
        allDay: ev.allDay,
        editable: false,
        extendedProps: { kind: "google", htmlLink: ev.htmlLink },
      });
    }
    for (const chip of dueChips.data ?? []) {
      // Date-only values are UTC midnight; take the UTC date parts for the all-day chip.
      list.push({
        id: `due-${chip.taskId}`,
        title: chip.title,
        start: chip.dueDate.slice(0, 10),
        allDay: true,
        editable: false,
        extendedProps: { kind: "due", taskId: chip.taskId, color: chip.projectColor },
      });
    }
    return list;
  }, [blocks.data, dueChips.data, googleEvents.data]);

  const removeBlock = useCallback<RemoveBlockFn>(
    (timeBlockId, taskId) => deleteTimeBlock.mutate({ timeBlockId, taskId }),
    [deleteTimeBlock],
  );
  const retryBlock = useCallback<RemoveBlockFn>(
    (timeBlockId, taskId) => retrySync.mutate({ timeBlockId, taskId }),
    [retrySync],
  );

  const onEventClick = useCallback(
    (info: EventClickArg) => {
      // The block's ⋯ menu button sits inside the event: its click opens the menu, not the task.
      if ((info.jsEvent.target as HTMLElement | null)?.closest("[data-block-menu]")) return;
      const props = info.event.extendedProps as { taskId?: string; kind?: string; htmlLink?: string | null };
      info.jsEvent.preventDefault(); // FullCalendar would follow an event url; we open links ourselves
      if (props.kind === "google") {
        if (props.htmlLink) window.open(props.htmlLink, "_blank", "noopener,noreferrer");
        return;
      }
      if (!props.taskId) return;
      const { start, end } = info.event;
      if (mobile && onBlockTap && props.kind === "block" && start && end) {
        const block = info.event.extendedProps as Pick<BlockTap, "color" | "completed" | "syncState" | "lastSyncError">;
        onBlockTap({
          timeBlockId: info.event.id,
          taskId: props.taskId,
          title: info.event.title,
          start,
          end,
          color: block.color,
          completed: block.completed,
          syncState: block.syncState,
          lastSyncError: block.lastSyncError,
        });
        return;
      }
      onOpenTask(props.taskId);
    },
    [onOpenTask, mobile, onBlockTap],
  );

  // Drag to move, resize to change the duration; the hooks toast on failure, we just undo here.
  const onEventChange = useCallback(
    async (info: EventDropArg | EventResizeDoneArg) => {
      const props = info.event.extendedProps as { taskId?: string };
      const start = info.event.start;
      const end = info.event.end;
      if (!props.taskId || !start || !end) {
        info.revert();
        return;
      }
      try {
        await updateTimeBlock.mutateAsync({
          timeBlockId: info.event.id,
          taskId: props.taskId,
          start: start.toISOString(),
          end: end.toISOString(),
        });
      } catch {
        info.revert();
      }
    },
    [updateTimeBlock],
  );

  // A rail row dropped on the grid creates a 60-minute block; on a whole day at 09:00 local.
  const onDrop = useCallback(
    (info: DropArg) => {
      const { taskId, title, color } = info.draggedEl.dataset;
      if (!taskId) return;
      const start = info.allDay
        ? new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate(), 9, 0, 0, 0)
        : info.date;
      const end = new Date(start.getTime() + 60 * 60_000);
      const created = createTimeBlock.mutateAsync({
        taskId,
        taskTitle: title ?? "",
        projectColor: color ?? "",
        start: start.toISOString(),
        end: end.toISOString(),
        tempId: `temp-${crypto.randomUUID()}`,
      });
      if (!mobile) {
        void created.catch(() => {}); // the hook toasts the failure
        return;
      }
      // Phone: say where it landed, with Undo (the drop target is small under a finger).
      void created
        .then((block) =>
          toast(scheduledLabel(start, end), {
            duration: 6000,
            action: { label: "Undo", onClick: () => deleteTimeBlock.mutate({ timeBlockId: block.id, taskId }) },
          }),
        )
        .catch(() => {});
    },
    [createTimeBlock, deleteTimeBlock, mobile],
  );

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
      initialView={mobile ? THREE_DAY_VIEW : "timeGridWeek"}
      views={{ [THREE_DAY_VIEW]: { type: "timeGrid", duration: { days: 3 } } }}
      // Touch: a long press picks up a block (then its resize handles show) or an external task.
      longPressDelay={TASK_LONG_PRESS_MS}
      dayHeaderContent={mobile ? (arg) => <PhoneDayHeader arg={arg} /> : undefined}
      allDayText={mobile ? "all day" : undefined}
      firstDay={1}
      timeZone="local"
      headerToolbar={false}
      nowIndicator
      scrollTime="08:00:00"
      slotDuration="00:30:00"
      snapDuration="00:15:00"
      slotLabelFormat={{ hour: "numeric", meridiem: "short" }}
      allDaySlot
      dayMaxEvents
      editable
      eventDurationEditable
      droppable
      height="100%"
      events={events}
      datesSet={onDatesSet}
      eventContent={(arg) => (
        <EventContent arg={arg} onRemove={removeBlock} onRetry={retryBlock} connected={connected} menu={!mobile} />
      )}
      eventClick={onEventClick}
      eventDrop={onEventChange}
      eventResize={onEventChange}
      drop={onDrop}
    />
  );
}
