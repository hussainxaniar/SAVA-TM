"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconAlignLeft,
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconLink,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useDeleteTaskAnywhere, useEditTask, useTask } from "@/hooks/use-task";
import { useTaskOrder } from "@/lib/task-nav";
import { formatDue, type DueTone } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/tasks/avatar-stack";
import { StatusControl, StatusGlyph } from "@/components/tasks/status-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskDetailDTO } from "@/server/services/types";
import { DescriptionEditor } from "./description-editor";
import { PropertiesColumn } from "./properties-column";

export type TaskDialogProps = {
  spaceId: string;
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  /** Open another task in place (breadcrumb ancestor, subtask row, ↑/↓). */
  onOpenTask: (taskId: string) => void;
};

/** The 1080×780 modal box (9.4): full-screen below 768px. */
const BOX_CLASS =
  "flex h-[780px] w-[1080px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl p-0 gap-0 " +
  "sm:max-w-[1080px] shadow-[0_24px_64px_rgb(24_24_27/0.28)] " +
  "max-md:h-dvh max-md:w-screen max-md:max-w-none max-md:rounded-none";

const TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-overdue",
  today: "text-success",
  default: "",
};

/**
 * Section 9.4 task dialog shell (T-11): header, title, description, subtasks and the read-only
 * properties column. Editing the other properties, and the Activity section, come in T-12–T-15.
 */
export function TaskDialog({ spaceId, taskId, open, onClose, onOpenTask }: TaskDialogProps) {
  const { data: task, error } = useTask(open ? taskId : null);
  const order = useTaskOrder();
  const editTask = useEditTask();
  const deleteTask = useDeleteTaskAnywhere();
  // Opening focuses the dialog box itself, not its first button (no stray focus ring on ↑).
  const popupRef = useRef<HTMLDivElement>(null);

  // ↑/↓ neighbours: where this task sits in the rows currently on screen.
  const index = taskId ? order.indexOf(taskId) : -1;
  const prevId = index > 0 ? order[index - 1] : null;
  const nextId = index >= 0 && index < order.length - 1 ? order[index + 1] : null;
  const step = useCallback(
    (id: string | null) => {
      if (id) onOpenTask(id);
    },
    [onOpenTask],
  );

  // ArrowUp / ArrowDown step through the list while no modifier is held and the user isn't
  // typing in a field (9.7). Esc and the click-outside close come from the Dialog itself.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      step(e.key === "ArrowUp" ? prevId : nextId);
    },
    [prevId, nextId, step],
  );

  const onSetStatus = useCallback(
    (t: { id: string }, statusId: string, completeSubtasks?: boolean) =>
      editTask.mutate({ taskId: t.id, statusId, completeSubtasks }),
    [editTask],
  );

  const copyLink = useCallback(() => {
    if (!task) return;
    const url = `${window.location.origin}/s/${spaceId}/p/${task.projectId}/l/${task.homeList.id}?task=${task.id}`;
    void navigator.clipboard.writeText(url);
    toast("Link copied");
  }, [spaceId, task]);

  const remove = useCallback(() => {
    if (!task) return;
    deleteTask.mutate({ taskId: task.id, title: task.title });
    onClose();
  }, [deleteTask, onClose, task]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        ref={popupRef}
        initialFocus={popupRef}
        showCloseButton={false}
        className={BOX_CLASS}
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">{task?.title ?? "Task"}</DialogTitle>
        <Header
          task={task}
          prevId={prevId}
          nextId={nextId}
          onStep={step}
          onClose={onClose}
          onCopyLink={copyLink}
          onDelete={remove}
        />
        {error ? (
          <ErrorState onClose={onClose} />
        ) : !task ? (
          <LoadingState />
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-y-auto p-6">
              <div className="flex items-start gap-3.5">
                <div className="mt-[3px] shrink-0">
                  <StatusControl task={task} statuses={task.statuses} size={22} onSetStatus={onSetStatus} />
                </div>
                <TitleEditor
                  key={task.id}
                  task={task}
                  onCommit={(title) => editTask.mutate({ taskId: task.id, title })}
                />
              </div>
              <div className="ml-10 mt-3 flex items-start gap-2.5">
                <IconAlignLeft aria-hidden className="mt-[3px] size-4 shrink-0 text-muted-foreground" />
                <DescriptionEditor
                  key={task.id}
                  description={task.description}
                  onSave={(description) => editTask.mutate({ taskId: task.id, description })}
                />
              </div>
              {task.subtaskCount > 0 && (
                <Subtasks task={task} statuses={task.statuses} onOpenTask={onOpenTask} />
              )}
            </div>
            <PropertiesColumn task={task} onSetStatus={onSetStatus} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Header (9.4.1) ----------

function Header({
  task,
  prevId,
  nextId,
  onStep,
  onClose,
  onCopyLink,
  onDelete,
}: {
  task: TaskDetailDTO | undefined;
  prevId: string | null;
  nextId: string | null;
  onStep: (id: string | null) => void;
  onClose: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-divider pl-7 pr-4">
      <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-muted-foreground">
        {task && (
          <>
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: task.project.color }}
            />
            <Link
              href={`/s/${task.spaceId}/p/${task.projectId}`}
              className="truncate hover:text-foreground"
            >
              {task.project.name}
            </Link>
            <Crumb />
            <Link
              href={`/s/${task.spaceId}/p/${task.projectId}/l/${task.homeList.id}`}
              className="truncate hover:text-foreground"
            >
              {task.homeList.name}
            </Link>
            {task.breadcrumb.map((ancestor) => (
              <span key={ancestor.id} className="flex min-w-0 items-center gap-1.5">
                <Crumb />
                <button
                  type="button"
                  className="truncate hover:text-foreground"
                  onClick={() => onStep(ancestor.id)}
                >
                  {ancestor.title}
                </button>
              </span>
            ))}
          </>
        )}
      </nav>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Previous task"
          disabled={!prevId}
          onClick={() => onStep(prevId)}
          className="size-7"
        >
          <IconChevronUp aria-hidden className="size-[18px] text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Next task"
          disabled={!nextId}
          onClick={() => onStep(nextId)}
          className="size-7"
        >
          <IconChevronDown aria-hidden className="size-[18px] text-muted-foreground" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" aria-label="Task actions" disabled={!task} className="size-7" />
            }
          >
            <IconDots aria-hidden className="size-[18px] text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Task</DropdownMenuLabel>
              <DropdownMenuItem onClick={onCopyLink}>
                <IconLink aria-hidden />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <IconTrash aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Close"
          onClick={onClose}
          className="size-7"
        >
          <IconX aria-hidden className="size-[18px] text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}

const Crumb = () => <span aria-hidden className="shrink-0 opacity-50">/</span>;

// ---------- Title (9.4.2) ----------

function TitleEditor({
  task,
  onCommit,
}: {
  task: TaskDetailDTO;
  onCommit: (title: string) => void;
}) {
  const [value, setValue] = useState(task.title);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Esc reverts, then blurs; the blur must not commit the text that was just discarded.
  const cancelled = useRef(false);

  const commit = useCallback(() => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = value.trim();
    if (!next) {
      setValue(task.title); // empty reverts
      return;
    }
    setValue(next);
    if (next !== task.title) onCommit(next);
  }, [value, task.title, onCommit]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={500}
      aria-label="Task title"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          // Revert without closing the dialog.
          e.preventDefault();
          e.stopPropagation();
          cancelled.current = true;
          setValue(task.title);
          ref.current?.blur();
        }
      }}
      onBlur={commit}
      className="min-w-0 flex-1 resize-none field-sizing-content bg-transparent text-2xl font-semibold leading-8 tracking-[-0.015em] outline-none"
    />
  );
}

// ---------- Subtasks (9.4.4, read-only rows in T-11) ----------

function Subtasks({
  task,
  statuses,
  onOpenTask,
}: {
  task: TaskDetailDTO;
  statuses: TaskDetailDTO["statuses"];
  onOpenTask: (taskId: string) => void;
}) {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.completedAt !== null).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <section className="ml-10 mt-7">
      <div className="flex h-8 items-center gap-2.5">
        <h3 className="text-sm font-semibold">Subtasks</h3>
        <span className="text-[13px] text-muted-foreground">
          {done}/{total}
        </span>
        <div aria-hidden className="ml-1.5 h-1 w-[120px] rounded-[2px] bg-pill">
          <div
            className="h-1 rounded-[2px] bg-success transition-width"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <ul>
        {task.subtasks.map((sub) => {
          const due = sub.dueDate ? formatDue(sub.dueDate, sub.dueHasTime, { completed: sub.completedAt !== null }) : null;
          const isDone = sub.completedAt !== null;
          return (
            <li key={sub.id}>
              <button
                type="button"
                onClick={() => onOpenTask(sub.id)}
                className="flex h-10 w-full items-center gap-3 border-b border-divider text-left"
              >
                <StatusGlyph status={sub.status} statuses={statuses} size={16} className="shrink-0" />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    isDone && "text-muted-foreground line-through",
                  )}
                >
                  {sub.title}
                </span>
                {due && (
                  <span className={cn("shrink-0 text-xs", TONE_CLASS[due.tone])}>{due.label}</span>
                )}
                <span className="flex shrink-0">
                  {sub.assignees.slice(0, 3).map((user, i) => (
                    <Avatar key={user.id} user={user} className={cn("size-5", i > 0 && "-ml-1.5")} />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- Loading and error states ----------

function LoadingState() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
      <div className="ml-10 h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="ml-10 h-4 w-5/6 animate-pulse rounded bg-muted" />
      <div className="ml-10 mt-4 h-4 w-1/3 animate-pulse rounded bg-muted" />
    </div>
  );
}

function ErrorState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="text-sm text-muted-foreground">
        This task was deleted or you don&apos;t have access.
      </p>
      <Button variant="outline" size="sm" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
