"use client";

import { memo } from "react";
import { IconCalendar, IconMessage } from "@tabler/icons-react";
import { Avatar } from "@/components/tasks/avatar-stack";
import { PriorityFlag } from "@/components/tasks/priority-flag";
import { StatusControl, SubtaskGlyph } from "@/components/tasks/status-icon";
import { formatDue } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import type { StatusDTO, TaskRowDTO } from "@/server/services/types";

/**
 * The phone task row (docs/design/mobile.md "Task row"): a 44px status control on the left, a
 * two-line body — title line, meta line — with the divider on the body, not the row.
 */
export const MobileTaskRow = memo(function MobileTaskRow({
  task,
  statuses,
  context,
  nested,
  onOpenTask,
  onSetStatus,
}: {
  task: TaskRowDTO;
  statuses: readonly StatusDTO[];
  /** Where the task lives. Given on My tasks; omitted where the list is already known (list page, subtasks). */
  context?: { projectName: string; listName: string; projectColor: string };
  /** Subtask under its parent: indented 28px. */
  nested?: boolean;
  onOpenTask: (taskId: string) => void;
  onSetStatus: (task: TaskRowDTO, statusId: string, completeSubtasks?: boolean) => void;
}) {
  const completed = task.completedAt !== null;
  const due = task.dueDate ? formatDue(task.dueDate, task.dueHasTime, { completed }) : null;
  const doneSubtasks = task.subtaskCount - task.openSubtaskCount;
  const flag = task.priority < 4;

  // The left part of the meta line. Without it (and without a project label) the avatars and the
  // flag move up beside the title, so a row never carries a second line just for an avatar.
  const hasLeftMeta = due !== null || task.subtaskCount > 0 || task.commentCount > 0;
  const hasMeta = hasLeftMeta || context !== undefined;
  const avatars =
    task.assignees.length > 0 ? (
      <span className="flex shrink-0 items-center">
        {task.assignees.slice(0, 3).map((user, i) => (
          <Avatar
            key={user.id}
            user={user}
            className={cn("size-[18px] border border-background text-[8px]", i > 0 && "-ml-1")}
          />
        ))}
      </span>
    ) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      data-row-id={task.id}
      onClick={() => onOpenTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpenTask(task.id);
      }}
      className={cn("flex items-start pr-4 active:bg-sidebar", nested ? "pl-8" : "pl-1")}
    >
      {/* Keep clicks, presses and keys from reaching the row: the status must not open the task. */}
      <span
        className="flex shrink-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <StatusControl task={task} statuses={statuses} onSetStatus={onSetStatus} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 border-b border-divider pb-3 pt-[11px]">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "min-w-0 flex-1 text-base leading-[22px] break-words line-clamp-2",
              completed ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {task.title}
          </span>
          {context && flag && <PriorityFlag priority={task.priority} size={18} className="mt-0.5" />}
          {!hasMeta && (avatars || flag) && (
            <span className="flex h-[22px] shrink-0 items-center gap-3">
              {avatars}
              {flag && <PriorityFlag priority={task.priority} size={16} />}
            </span>
          )}
        </div>
        {hasMeta && (
          <div className="flex h-[18px] items-center gap-3 text-xs leading-4 text-muted-foreground">
            {due && (
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1",
                  due.tone === "overdue" ? "text-overdue" : due.tone === "today" ? "text-success" : undefined,
                )}
              >
                <IconCalendar className="size-3.5" stroke={2} />
                {due.label}
              </span>
            )}
            {task.subtaskCount > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                <SubtaskGlyph size={14} />
                {doneSubtasks}/{task.subtaskCount}
              </span>
            )}
            {task.commentCount > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                <IconMessage className="size-3.5" stroke={2} />
                {task.commentCount}
              </span>
            )}
            <span className="min-w-1 flex-1" />
            {avatars}
            {context ? (
              <span className="flex min-w-0 max-w-[200px] shrink items-center gap-1.5">
                <span className="truncate text-right">
                  {context.projectName}/{context.listName}
                </span>
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: context.projectColor }}
                />
              </span>
            ) : (
              flag && <PriorityFlag priority={task.priority} size={16} />
            )}
          </div>
        )}
      </div>
    </div>
  );
});