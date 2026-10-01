"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconAlignLeft,
  IconArrowRight,
  IconChevronDown,
  IconChevronUp,
  IconCornerLeftUp,
  IconDots,
  IconLink,
  IconList,
  IconPlaylistAdd,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  useAddToList,
  useDeleteTaskAnywhere,
  useEditTask,
  useMoveTask,
  useRemoveFromList,
  useSetAssignees,
  useSetParent,
  useTask,
  type TaskEdit,
} from "@/hooks/use-task";
import { useTaskOrder } from "@/lib/task-nav";
import { StatusControl } from "@/components/tasks/status-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskDetailDTO, UserLite } from "@/server/services/types";
import { DescriptionEditor } from "./description-editor";
import { PropertiesColumn } from "./properties-column";
import { Subtasks } from "./subtasks";

export type TaskDialogProps = {
  spaceId: string;
  /** Current space members, for the Assignees picker. */
  members: UserLite[];
  /** The signed-in user, for the comment composer (T-15 wires it into the Activity section). */
  me: UserLite;
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

/**
 * Section 9.4 task dialog shell (T-11): header, title, description, subtasks and the read-only
 * properties column. Editing the other properties, and the Activity section, come in T-12–T-15.
 */
export function TaskDialog({ spaceId, members, taskId, open, onClose, onOpenTask }: TaskDialogProps) {
  const { data: task, error } = useTask(open ? taskId : null);
  const order = useTaskOrder();
  const editTask = useEditTask();
  const setAssigneesMutation = useSetAssignees();
  const deleteTask = useDeleteTaskAnywhere();
  const setParent = useSetParent();
  const moveTask = useMoveTask();
  const addToListMutation = useAddToList();
  const removeFromListMutation = useRemoveFromList();
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

  // Field edits (dates, priority) and assignee changes for the properties column (6.8, 9.4.6).
  const onEditTask = useCallback(
    (edit: Omit<TaskEdit, "taskId">) => {
      if (!task) return;
      editTask.mutate({ taskId: task.id, ...edit });
    },
    [editTask, task],
  );

  const onSetAssignees = useCallback(
    (assignees: UserLite[]) => {
      if (!task) return;
      setAssigneesMutation.mutate({ taskId: task.id, assignees });
    },
    [setAssigneesMutation, task],
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

  // Promote to a top-level task; the dialog stays open and the breadcrumb refetches (6.4.3).
  const convert = useCallback(async () => {
    if (!task) return;
    try {
      await setParent.mutateAsync({ taskId: task.id, parentId: null });
      toast.success("Converted to a task");
    } catch {
      // the hook toasted the failure
    }
  }, [setParent, task]);

  // Move / link from the ⋯ menu and the Lists section (6.5, 6.6). The dialog stays open on
  // the same task; breadcrumb and Lists section update when the task refetches.
  const moveToList = useCallback(
    async (listId: string) => {
      if (!task) return;
      const list = task.project.lists.find((l) => l.id === listId);
      try {
        await moveTask.mutateAsync({ taskId: task.id, fromListId: task.homeList.id, toListId: listId });
        if (list) toast.success(`Moved to "${list.name}"`);
      } catch {
        // the hook toasted the failure
      }
    },
    [moveTask, task],
  );

  const addToList = useCallback(
    async (listId: string) => {
      if (!task) return;
      const list = task.project.lists.find((l) => l.id === listId);
      try {
        await addToListMutation.mutateAsync({ taskId: task.id, listId });
        if (list) toast.success(`Added to "${list.name}"`);
      } catch {
        // the hook toasted the failure
      }
    },
    [addToListMutation, task],
  );

  const removeFromList = useCallback(
    async (listId: string) => {
      if (!task) return;
      const list = task.linkedLists.find((l) => l.id === listId);
      try {
        await removeFromListMutation.mutateAsync({ taskId: task.id, listId });
        if (list) toast.success(`Removed from "${list.name}"`);
      } catch {
        // the hook toasted the failure
      }
    },
    [removeFromListMutation, task],
  );

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
          canConvert={!!task?.parentId}
          onConvert={convert}
          onMoveToList={moveToList}
          onAddToList={addToList}
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
              <Subtasks task={task} onOpenTask={onOpenTask} />
            </div>
            <PropertiesColumn
              task={task}
              members={members}
              onSetStatus={onSetStatus}
              onSetAssignees={onSetAssignees}
              onEditTask={onEditTask}
              onAddToList={addToList}
              onRemoveFromList={removeFromList}
            />
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
  canConvert,
  onConvert,
  onMoveToList,
  onAddToList,
}: {
  task: TaskDetailDTO | undefined;
  prevId: string | null;
  nextId: string | null;
  onStep: (id: string | null) => void;
  onClose: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  canConvert: boolean;
  onConvert: () => void;
  onMoveToList: (listId: string) => void;
  onAddToList: (listId: string) => void;
}) {
  // Move to (6.5): top-level tasks only. Add to list (6.6): except home and linked lists.
  const moveTargets =
    task && task.parentId === null
      ? task.project.lists.filter((l) => l.id !== task.homeList.id)
      : [];
  const addTargets = task
    ? task.project.lists.filter(
        (l) => l.id !== task.homeList.id && !task.linkedListIds.includes(l.id),
      )
    : [];
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
              {moveTargets.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <IconArrowRight aria-hidden />
                    Move to
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {moveTargets.map((list) => (
                      <DropdownMenuItem key={list.id} onClick={() => onMoveToList(list.id)}>
                        <IconList aria-hidden />
                        {list.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {addTargets.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <IconPlaylistAdd aria-hidden />
                    Add to list
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {addTargets.map((list) => (
                      <DropdownMenuItem key={list.id} onClick={() => onAddToList(list.id)}>
                        <IconList aria-hidden />
                        {list.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canConvert && (
                <DropdownMenuItem onClick={onConvert}>
                  <IconCornerLeftUp aria-hidden />
                  Convert to task
                </DropdownMenuItem>
              )}
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
