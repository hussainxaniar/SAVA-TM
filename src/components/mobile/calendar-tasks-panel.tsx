"use client";

import { IconClock, IconHandFinger, IconX } from "@tabler/icons-react";
import { useCalendarTasks } from "@/hooks/use-calendar";
import { useTaskDragSource } from "@/hooks/use-task-drag-source";
import { formatDue } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import type { CalendarTaskDTO } from "@/server/services/types";

/*
 * The phone calendar's "See tasks" panel (docs/design/mobile/05-calendar-schedule-flow #1): a
 * bottom panel over a scrim with my open tasks. A row is lifted with a long press (350 ms) and
 * dropped on the grid to create a 60-minute block, so the panel slides away while the drag is
 * live but stays mounted (FullCalendar still reads the lifted row).
 */

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** A short "Mon 15:00" style label for the task's next scheduled slot. */
function slotLabel(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const diff = Math.round((dayStart(d) - dayStart(new Date())) / 86_400_000);
  const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString([], { weekday: "short" });
  return `${day} ${time}`;
}

export function CalendarTasksPanel({
  spaceId,
  open,
  hidden,
  onClose,
  onOpenTask,
  onDragStart,
  onDragEnd,
}: {
  spaceId: string;
  open: boolean;
  /** True while a task is being dragged to the grid: the panel slides away but stays mounted. */
  hidden: boolean;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const visible = open && !hidden;
  const tasks = useCalendarTasks(spaceId, null).data ?? [];
  const dragRef = useTaskDragSource<HTMLDivElement>({ onDragStart, onDragEnd });

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-scrim transition-opacity duration-200",
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        role={open ? "dialog" : undefined}
        aria-label="My tasks"
        inert={!open}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex max-h-[70dvh] flex-col rounded-t-2xl bg-popover pb-[env(safe-area-inset-bottom)] transition-transform duration-200",
          visible ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div aria-hidden className="flex h-5 shrink-0 items-center justify-center">
          <span className="h-1 w-9 rounded-full bg-input" />
        </div>
        <header className="flex h-11 shrink-0 items-center gap-2 pl-4 pr-1">
          <h2 className="text-[17px] font-semibold leading-6 text-foreground">My tasks</h2>
          <span className="flex-1 text-[13px] text-muted-foreground">{tasks.length}</span>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-11 items-center justify-center">
            <IconX className="size-[22px] text-icon" />
          </button>
        </header>
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 text-[13px] text-muted-foreground">
          <IconHandFinger className="size-4 shrink-0" aria-hidden />
          Hold a task, then drag it onto the calendar
        </div>
        <div ref={dragRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {tasks.length === 0 ? (
            <p className="px-4 py-6 text-[15px] text-muted-foreground">No open tasks assigned to you.</p>
          ) : (
            tasks.map((task) => <PanelRow key={task.id} task={task} onOpenTask={onOpenTask} />)
          )}
        </div>
      </div>
    </>
  );
}

function PanelRow({ task, onOpenTask }: { task: CalendarTaskDTO; onOpenTask: (taskId: string) => void }) {
  const due = task.dueDate ? formatDue(task.dueDate, task.dueHasTime) : null;
  return (
    <div
      data-task-id={task.id}
      data-title={task.title}
      data-color={task.projectColor}
      className="sava-drag-row flex flex-col gap-1 border-b border-divider px-4 py-3"
      onClick={() => onOpenTask(task.id)}
    >
      <div className="line-clamp-2 text-base leading-[22px] text-foreground">{task.title}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: task.projectColor }}
        />
        <span className="min-w-0 flex-1 truncate">
          {task.projectName}/{task.listName}
        </span>
        {task.nextBlockStart && (
          <span className="flex shrink-0 items-center gap-1">
            <IconClock className="size-3.5" aria-hidden />
            {slotLabel(task.nextBlockStart)}
          </span>
        )}
        {due && (
          <span className={cn("shrink-0", due.tone === "overdue" && "text-overdue", due.tone === "today" && "text-success")}>
            {due.label}
          </span>
        )}
      </div>
    </div>
  );
}