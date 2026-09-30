"use client";

import { memo, useState } from "react";
import { Calendar, ChevronDown, ChevronRight, Link } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AvatarStack } from "@/components/tasks/avatar-stack";
import { StatusGlyph, SubtaskGlyph } from "@/components/tasks/status-icon";
import { PriorityFlag } from "@/components/tasks/priority-flag";
import { TaskRowMenu } from "@/components/tasks/task-row-menu";
import { formatDue, type DisplayMode, type ListRow } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import type { Priority, TaskRowDTO } from "@/server/services/types";

/** dnd-kit's draggable attributes/listeners, loosely typed so this file needn't import dnd internals. */
export type DragHandle = {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
};

type CompleteOpts = { completed: boolean; includeSubtasks?: boolean };

export type TaskRowProps = {
  row: ListRow;
  mode: DisplayMode;
  dragHandle: DragHandle | null;
  collapsed: boolean;
  onToggleCollapsed: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  onComplete: (task: TaskRowDTO, opts: CompleteOpts) => void;
  onSetPriority: (taskId: string, priority: Priority) => void;
  onDeleteTask: (task: TaskRowDTO) => void;
  onAddChild: (task: TaskRowDTO) => void;
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
  onToggleCollapsed,
  onOpenTask,
  onComplete,
  onSetPriority,
  onDeleteTask,
  onAddChild,
}: TaskRowProps) {
  const { task } = row;
  const done = task.completedAt !== null;
  const temp = task.id.startsWith("temp-");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestComplete() {
    if (done) {
      onComplete(task, { completed: false });
    } else if (task.openSubtaskCount > 0) {
      setConfirmOpen(true);
    } else {
      onComplete(task, { completed: true });
    }
  }

  const titleClass = cn(
    "truncate text-sm text-foreground",
    row.hasChildren && "font-medium",
    done && "text-muted-foreground line-through",
  );

  const linkIcon = task.isLinkedHere ? (
    <Link className="size-[13px] shrink-0 text-muted-foreground/60" aria-hidden />
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
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {!temp && (
        <span onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
          <TaskRowMenu
            task={task}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onOpenTask={onOpenTask}
            onComplete={onComplete}
            onSetPriority={onSetPriority}
            onDeleteTask={onDeleteTask}
          />
        </span>
      )}
    </div>
  );

  const handle =
    dragHandle && !temp ? (
      <button
        type="button"
        aria-label={`Reorder ${task.title}`}
        className="absolute -left-[22px] top-1/2 z-10 flex -translate-y-1/2 cursor-grab items-center justify-center text-muted-foreground/60 opacity-0 group-hover/row:opacity-100 active:cursor-grabbing"
        {...dragHandle.attributes}
        {...dragHandle.listeners}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className="fill-current">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
    ) : null;

  const statusButton = (
    <button
      type="button"
      aria-label={`${done ? "Reopen" : "Complete"} ${task.title}`}
      disabled={temp}
      onClick={(e) => {
        e.stopPropagation();
        requestComplete();
      }}
      className="shrink-0 disabled:pointer-events-none"
    >
      <StatusGlyph category={task.status.category} size={done ? 16 : 18} />
    </button>
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

  const confirmDialog = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Also complete {task.openSubtaskCount} open subtask
            {task.openSubtaskCount === 1 ? "" : "s"}?
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onComplete(task, { completed: true })}>
            Only this task
          </AlertDialogCancel>
          <AlertDialogAction
            autoFocus
            onClick={(e) => {
              e.preventDefault();
              setConfirmOpen(false);
              onComplete(task, { completed: true, includeSubtasks: true });
            }}
          >
            Complete all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const rowProps = {
    onClick: () => {
      if (!temp) onOpenTask(task.id);
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (temp) return;
      e.preventDefault();
      setMenuOpen(true);
    },
    className: cn(
      "group/row relative flex border-b border-divider hover:-mx-2 hover:rounded-md hover:bg-sidebar hover:px-2",
      mode === "NESTED" ? "min-h-9 items-center" : "items-start py-2.5",
    ),
  } as const;

  if (mode === "SEPARATE") {
    return (
      <div {...rowProps}>
        {handle}
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
                  <Calendar className="size-3" />
                  <span className={due.className}>{due.label}</span>
                </span>
              )}
              {subs && <span className="flex items-center gap-1">{subs}</span>}
              {flag}
            </span>
          )}
        </div>
        {actions}
        <div className="flex w-16 shrink-0 items-center self-stretch justify-center">
          <AvatarStack users={task.assignees} />
        </div>
        {confirmDialog}
      </div>
    );
  }

  return (
    <div {...rowProps}>
      {handle}
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
              <ChevronRight className="size-3" strokeWidth={3} />
            ) : (
              <ChevronDown className="size-3" strokeWidth={3} />
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
      <div className="flex w-14 shrink-0 items-center gap-1">{subs}</div>
      <div className="flex w-[72px] shrink-0 items-center">
        <AvatarStack users={task.assignees} />
      </div>
      <div className={cn("w-24 shrink-0 truncate text-[13px]", due?.className)}>
        {due?.label}
      </div>
      <div className="flex w-8 shrink-0 justify-center">{flag}</div>
      {confirmDialog}
    </div>
  );
});
