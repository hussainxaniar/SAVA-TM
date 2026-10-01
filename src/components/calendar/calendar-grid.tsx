"use client";

import { useCallback, useMemo, type RefObject } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { DropArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import {
  useCreateTimeBlock,
  useDeleteTimeBlock,
  useDueChips,
  useTimeBlocks,
  useUpdateTimeBlock,
  type Range,
} from "@/hooks/use-calendar";
import { EventContent, type RemoveBlockFn } from "./block-event";

type CalendarGridProps = {
  spaceId: string;
  range: Range | null;
  calendarRef: RefObject<FullCalendar | null>;
  onDatesSet: (arg: DatesSetArg) => void;
  onOpenTask: (taskId: string) => void;
};

/**
 * The FullCalendar grid (10.1). Blocks come from ['calendar', spaceId, 'blocks'], date-only due
 * dates render as all-day chips. Every option the grid needs is named in docs/tickets/T-17.md §3.
 */
export function CalendarGrid({ spaceId, range, calendarRef, onDatesSet, onOpenTask }: CalendarGridProps) {
  const blocks = useTimeBlocks(spaceId, range);
  const dueChips = useDueChips(spaceId, range);
  const createTimeBlock = useCreateTimeBlock(spaceId);
  const updateTimeBlock = useUpdateTimeBlock(spaceId);
  const deleteTimeBlock = useDeleteTimeBlock(spaceId);

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
        },
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
  }, [blocks.data, dueChips.data]);

  const removeBlock = useCallback<RemoveBlockFn>(
    (timeBlockId, taskId) => deleteTimeBlock.mutate({ timeBlockId, taskId }),
    [deleteTimeBlock],
  );

  const onEventClick = useCallback(
    (info: EventClickArg) => {
      // The block's ⋯ menu button sits inside the event: its click opens the menu, not the task.
      if ((info.jsEvent.target as HTMLElement | null)?.closest("[data-block-menu]")) return;
      const props = info.event.extendedProps as { taskId?: string };
      if (props.taskId) onOpenTask(props.taskId);
    },
    [onOpenTask],
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
      void createTimeBlock.mutateAsync({
        taskId,
        taskTitle: title ?? "",
        projectColor: color ?? "",
        start: start.toISOString(),
        end: end.toISOString(),
        tempId: `temp-${crypto.randomUUID()}`,
      });
    },
    [createTimeBlock],
  );

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
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
      eventContent={(arg) => <EventContent arg={arg} onRemove={removeBlock} />}
      eventClick={onEventClick}
      eventDrop={onEventChange}
      eventResize={onEventChange}
      drop={onDrop}
    />
  );
}
