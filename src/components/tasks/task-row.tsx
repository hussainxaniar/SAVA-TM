"use client";

import { memo, useState } from "react";
import { IconCalendar, IconChevronDown, IconChevronRight, IconLink, IconPlus } from "@tabler/icons-react";
import { AvatarStack } from "@/components/tasks/avatar-stack";
import { StatusControl, SubtaskGlyph } from "@/components/tasks/status-icon";
import { PriorityFlag } from "@/components/tasks/priority-flag";
import { TaskRowMenu } from "@/components/tasks/task-row-menu";
import { AssigneeCell, DueCell, PriorityCell } from "@/components/tasks/row-cell-actions";
import { rowKeyboardOnly } from "@/lib/dnd";
import { formatDue, type DisplayMode, type ListRow } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import type { Priority, StatusDTO, TaskRowDTO, UserLite } from "@/server/services/types";

/**
 * dnd-kit's draggable state, loosely typed so this file needn't import dnd internals. The
 * listeners go on the row itself — dragging starts after 4px (PointerSensor), so plain
 * clicks still work.
 */
export type DragHandle = {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  isDragging: boolean;
};

type CompleteOpts = { completed: boolean; includeSubtasks?: boolean };

export type TaskRowProps = {
  row: ListRow;
  mode: DisplayMode;
  dragHandle: DragHandle | null;
  collapsed: boolean;
  statuses: readonly StatusDTO[];
  onToggleCollapsed: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  onComplete: (task: TaskRowDTO, opts: CompleteOpts) => void;
  onSetStatus: (task: TaskRowDTO, statusId: string, completeSubtasks?: boolean) => void;
  onSetPriority: (taskId: string, priority: Priority) => void;
  /** A quick day (date-only) or null to clear the due date. */
  onSetDue: (task: TaskRowDTO, day: Date | null) => void;
  /** Adds the member to the task's assignees, or removes them if already assigned (the row's quick "add assignee"). */
  onToggleAssignee: (task: TaskRowDTO, member: UserLite) => void;
  onDeleteTask: (task: TaskRowDTO) => void;
  onAddChild: (task: TaskRowDTO) => void;
  onMakeSubtaskOf: (task: TaskRowDTO, parentId: string) => void;
  onConvertToTask: (task: TaskRowDTO) => void;
  onMoveToList: (task: TaskRowDTO, listId: string) => void;
  onAddToList: (task: TaskRowDTO, listId: string) => void;
  onRemoveFromList: (task: TaskRowDTO) => void;
  /** Valid parents for a task id (parentCandidates); computed on demand by the menu. */
  candidatesFor: (taskId: string) => TaskRowDTO[];
  /** The project's active lists in order (the row menu's Move to / Add to list pickers). */
  lists: readonly { id: string; name: string }[];
  /** Keyboard selection ring (9.7). */
  selected?: boolean;
};

function dueLabel(task: TaskRowDTO) {
  if (!task.dueDate) return null;
  const done = task.completedAt !== null;
  const { label, tone } = formatDue(task.dueDate, task.dueHasTime, { completed: done });
  const className = done
    ? "text-muted-foreground"
    : tone === "overdue"
      ? "text-overdue"
      : tone === "today"
        ? "text-success font-medium"
        : "text-foreground/80";
  return { label, className };
}

/** One task row: NESTED (fixed right columns) or SEPARATE (stacked text lines). */
export const TaskRow = memo(function TaskRow({
  row,
  mode,
  dragHandle,
  collapsed,
  statuses,
  onToggleCollapsed,
  onOpenTask,
  onComplete,
  onSetStatus,
  onSetPriority,
  onSetDue,
  onToggleAssignee,
  onDeleteTask,
  onAddChild,
  onMakeSubtaskOf,
  onConvertToTask,
  onMoveToList,
  onAddToList,
  onRemoveFromList,
  candidatesFor,
  lists,
  selected,
}: TaskRowProps) {
  const { task } = row;
  const done = task.completedAt !== null;
  const temp = task.id.startsWith("temp-");
  const [menuOpen, setMenuOpen] = useState(false);

  const titleClass = cn(
    "truncate text-sm text-foreground",
    row.hasChildren && "font-medium",
    done && "text-muted-foreground line-through",
  );

  const linkIcon = task.isLinkedHere ? (
    <IconLink className="size-[13px] shrink-0 text-muted-foreground/60" aria-hidden />
  ) : null;

  // Hover actions: + (add subtask, max three levels) and the ⋯ menu; stay while the menu is open.
  const actions = (
    <div className={cn("mr-3 flex shrink-0 gap-0.5", !menuOpen && "opacity-0 group-hover/row:opacity-100")}>
      {task.depth < 2 && (
        <button
          type="button"
          aria-label="Add subtask"
          disabled={temp}
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(task);
          }}
          className="flex size-[26px] items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-sidebar disabled:pointer-events-none"
        >
          <IconPlus className="size-3.5" aria-hidden />
        </button>
      )}
      {!temp && (
        // Portaled menus and the picker still bubble React events to the row: keep clicks (open),
        // pointer-downs (drag) and keys (keyboard drag on Space/Enter) from reaching it.
        <span
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <TaskRowMenu
            task={task}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onOpenTask={onOpenTask}
            onComplete={onComplete}
            onSetPriority={onSetPriority}
            onSetDue={onSetDue}
            onDeleteTask={onDeleteTask}
            onMakeSubtaskOf={onMakeSubtaskOf}
            onConvertToTask={onConvertToTask}
            onMoveToList={onMoveToList}
            onAddToList={onAddToList}
            onRemoveFromList={onRemoveFromList}
            candidatesFor={candidatesFor}
            lists={lists}
            statuses={statuses}
          />
        </span>
      )}
    </div>
  );

  const statusButton = (
    <span
      className="flex"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <StatusControl task={task} statuses={statuses} disabled={temp} onSetStatus={onSetStatus} />
    </span>
  );

  const subs =
    task.subtaskCount > 0 ? (
      <>
        <SubtaskGlyph size={mode === "NESTED" ? 13 : 12} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {task.subtaskCount - task.openSubtaskCount}/{task.subtaskCount}
        </span>
      </>
    ) : null;

  const due = dueLabel(task);
  const flag = task.priority < 4 ? <PriorityFlag priority={task.priority} /> : null;

  // Dragging: the row itself carries the dnd listeners (a 4px move starts the drag, so
  // clicks, menus and the status control still work); only roots in manual sort get a handle.
  const drag =
    dragHandle && !temp
      ? { attributes: dragHandle.attributes, listeners: dragHandle.listeners }
      : {};
  const dragging = dragHandle?.isDragging ?? false;

  const rowProps = {
    onClick: () => {
      if (!temp) onOpenTask(task.id);
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (temp) return;
      e.preventDefault();
      setMenuOpen(true);
    },
    // The selection keys look this up to scroll the selected row into view (9.7).
    "data-row-id": task.id,
    className: cn(
      "group/row relative flex border-b border-divider hover:-mx-2 hover:rounded-md hover:bg-sidebar hover:px-2",
      mode === "NESTED" ? "min-h-9 items-center" : "items-start py-2.5",
      drag.listeners && "cursor-grab",
      dragging && "cursor-grabbing opacity-50",
      selected && "ring-1 ring-primary/40 rounded-md",
    ),
    ...drag.attributes,
    // Space / Enter start a keyboard drag only on the row itself, not on a button inside it (cell pickers, chevron).
    ...rowKeyboardOnly(drag.listeners),
  } as const;

  if (mode === "SEPARATE") {
    return (
      <div {...rowProps}>
        <div className="w-5 shrink-0" />
        <div className="mt-px ml-0.5 mr-3 shrink-0">{statusButton}</div>
        <div className="flex min-w-0 grow flex-col gap-[3px]">
          {row.showParent && task.parentId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTask(task.parentId!);
              }}
              className="flex items-center gap-1.5 text-left text-xs text-muted-foreground hover:underline"
            >
              <SubtaskGlyph size={12} className="text-muted-foreground" />
              <span className="truncate">{task.parentTitle}</span>
            </button>
          )}
          <span className="flex items-center gap-1.5 text-sm leading-5 text-foreground">
            <span className={cn("truncate", titleClass)}>{task.title}</span>
            {linkIcon}
          </span>
          {(due || subs || flag) && (
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {due && (
                <span className="flex items-center gap-1">
                  <IconCalendar className="size-3" />
                  <span className={due.className}>{due.label}</span>
                </span>
              )}
              {subs && <span className="flex max-md:hidden items-center gap-1">{subs}</span>}
              {flag}
            </span>
          )}
        </div>
        {actions}
        <div className="hidden w-16 shrink-0 items-center self-stretch justify-center md:flex">
          <AvatarStack users={task.assignees} />
        </div>
      </div>
    );
  }

  return (
    <div {...rowProps}>
      <div className="w-5 shrink-0" />
      {Array.from({ length: row.indent }, (_, i) => (
        <div key={i} className="w-5 shrink-0" />
      ))}
      <div className="flex w-5 shrink-0 justify-center">
        {row.hasChildren && (
          <button
            type="button"
            aria-label={collapsed ? "Expand subtasks" : "Collapse subtasks"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapsed(task.id);
            }}
            className="flex items-center justify-center text-muted-foreground"
          >
            {collapsed ? (
              <IconChevronRight className="size-3" strokeWidth={3} />
            ) : (
              <IconChevronDown className="size-3" strokeWidth={3} />
            )}
          </button>
        )}
      </div>
      <div className="ml-0.5 mr-2.5 shrink-0">{statusButton}</div>
      {row.showParent && task.parentId ? (
        <div className="flex min-w-0 grow flex-col justify-center gap-0.5 py-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenTask(task.parentId!);
            }}
            className="max-w-full truncate text-left text-[11px] text-muted-foreground hover:underline"
          >
            ↳ {task.parentTitle}
          </button>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={titleClass}>{task.title}</span>
            {linkIcon}
          </span>
        </div>
      ) : (
        <span className="flex min-w-0 grow items-center gap-1.5">
          <span className={titleClass}>{task.title}</span>
          {linkIcon}
        </span>
      )}
      {actions}
      <div className="hidden w-14 shrink-0 items-center gap-1 md:flex">{subs}</div>
      {temp ? (
        // Temporary rows cannot be edited yet: plain cells, no triggers.
        <>
          <div className="hidden w-[72px] shrink-0 items-center md:flex">
            <AvatarStack users={task.assignees} />
          </div>
          <div className={cn("w-24 shrink-0 truncate text-[13px]", due?.className)}>{due?.label}</div>
          <div className="flex w-8 shrink-0 justify-center">{flag}</div>
        </>
      ) : (
        <>
          <AssigneeCell task={task} onToggle={onToggleAssignee} />
          <DueCell task={task} label={due?.label} className={due?.className} onSetDue={onSetDue} />
          <PriorityCell task={task} onSetPriority={onSetPriority} />
        </>
      )}
    </div>
  );
});
