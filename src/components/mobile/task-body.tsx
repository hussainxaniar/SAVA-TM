"use client";

import { useState } from "react";
import {
  IconCalendar,
  IconChevronDown,
  IconCornerLeftUp,
  IconDots,
  IconLink,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { ActivitySection } from "@/components/task-dialog/activity";
import { DescriptionEditor } from "@/components/task-dialog/description-editor";
import { LinkedDocs } from "@/components/task-dialog/linked-docs";
import { TitleEditor } from "@/components/task-dialog/task-dialog";
import { AssigneesSheet, DueDateSheet, PrioritySheet } from "@/components/mobile/task-pickers";
import { MobileSubtasks } from "@/components/mobile/task-subtasks";
import { Avatar } from "@/components/tasks/avatar-stack";
import { PriorityFlag } from "@/components/tasks/priority-flag";
import { StatusControl } from "@/components/tasks/status-icon";
import { BottomSheet, BottomSheetOption } from "@/components/ui/bottom-sheet";
import { formatDue } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import type { Priority, TaskDetailDTO, UserLite } from "@/server/services/types";

/** The chip's shared look; a chip without a value is dashed and muted with a plus. */
const CHIP = "flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] font-medium";
const CHIP_EMPTY = "border-dashed border-input text-muted-foreground";

/** First word of a name ("Maryam Rahimi" → "Maryam"). */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The phone task details body (docs/design/mobile/02-task-details): a header with close, the
 * project/list breadcrumb and the actions menu; a scroll area with the status + title +
 * description block, the property chips, subtasks, linked docs and the activity feed with its
 * docked composer; and the property pickers as bottom sheets. Every mutation stays in the task
 * dialog — this body only renders and hands the edits up.
 */
export function MobileTaskBody({
  task,
  members,
  me,
  onClose,
  onOpenTask,
  onSetStatus,
  onEditTask,
  onSetAssignees,
  onCommitTitle,
  onSaveDescription,
  onCopyLink,
  onDelete,
  canConvert,
  onConvert,
}: {
  task: TaskDetailDTO;
  members: UserLite[];
  me: UserLite;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  onSetStatus: (task: { id: string }, statusId: string, completeSubtasks?: boolean) => void;
  onEditTask: (edit: { dueDate?: string | null; dueHasTime?: boolean; priority?: Priority }) => void;
  onSetAssignees: (assignees: UserLite[]) => void;
  onCommitTitle: (title: string) => void;
  onSaveDescription: (description: { type: "doc"; [key: string]: unknown } | null) => void;
  onCopyLink: () => void;
  onDelete: () => void;
  canConvert: boolean;
  onConvert: () => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [assigneesOpen, setAssigneesOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  const completed = task.completedAt !== null;
  const due = task.dueDate ? formatDue(task.dueDate, task.dueHasTime, { completed }) : null;
  const lastAncestor = task.breadcrumb.length > 0 ? task.breadcrumb[task.breadcrumb.length - 1] : null;
  const names = task.assignees.map((u) => firstName(u.name));
  const assigneeLabel =
    names.length <= 2 ? names.join(", ") : `${names[0]}, ${names[1]} +${names.length - 2}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex h-11 shrink-0 items-center px-1">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center text-foreground"
        >
          <IconChevronDown aria-hidden className="size-6" stroke={2} />
        </button>
        <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted-foreground">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: task.project.color }}
          />
          <span className="min-w-0 truncate">
            {task.project.name}/{task.homeList.name}
          </span>
          {lastAncestor && (
            <>
              <span aria-hidden className="shrink-0 opacity-50">
                /
              </span>
              <button
                type="button"
                onClick={() => onOpenTask(lastAncestor.id)}
                className="min-w-0 truncate text-left hover:text-foreground"
              >
                {lastAncestor.title}
              </button>
            </>
          )}
        </nav>
        <button
          type="button"
          aria-label="Task actions"
          onClick={() => setActionsOpen(true)}
          className="flex size-11 shrink-0 items-center justify-center text-foreground"
        >
          <IconDots aria-hidden className="size-6" stroke={2} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex items-start pl-1 pr-4 pt-1">
          <StatusControl task={task} statuses={task.statuses} size={24} onSetStatus={onSetStatus} />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-2">
            <TitleEditor
              key={task.id}
              task={task}
              onCommit={onCommitTitle}
              className="text-xl font-semibold leading-7 tracking-[-0.01em]"
            />
            <DescriptionEditor
              key={task.id}
              description={task.description}
              spaceId={task.spaceId}
              onSave={onSaveDescription}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border py-4 pl-12 pr-4">
          <StatusControl task={task} statuses={task.statuses} variant="pill" onSetStatus={onSetStatus} />
          <button
            type="button"
            onClick={() => setDueOpen(true)}
            className={cn(
              CHIP,
              due
                ? due.tone === "overdue"
                  ? "text-overdue"
                  : due.tone === "today"
                    ? "text-success"
                    : undefined
                : CHIP_EMPTY,
            )}
          >
            {due ? (
              <>
                <IconCalendar aria-hidden className="size-4 shrink-0" stroke={2} />
                {due.label}
              </>
            ) : (
              <>
                <IconPlus aria-hidden className="size-4 shrink-0" stroke={2} />
                Due date
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPriorityOpen(true)}
            className={cn(CHIP, task.priority < 4 ? undefined : CHIP_EMPTY)}
          >
            {task.priority < 4 ? (
              <>
                <PriorityFlag priority={task.priority} size={16} />
                P{task.priority}
              </>
            ) : (
              <>
                <IconPlus aria-hidden className="size-4 shrink-0" stroke={2} />
                Priority
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAssigneesOpen(true)}
            className={cn(CHIP, task.assignees.length > 0 ? undefined : CHIP_EMPTY)}
          >
            {task.assignees.length > 0 ? (
              <>
                <span className="flex shrink-0 items-center">
                  {task.assignees.slice(0, 3).map((user, i) => (
                    <Avatar
                      key={user.id}
                      user={user}
                      className={cn("size-5 text-[9px]", i > 0 && "-ml-1")}
                    />
                  ))}
                </span>
                {assigneeLabel}
              </>
            ) : (
              <>
                <IconPlus aria-hidden className="size-4 shrink-0" stroke={2} />
                Assignee
              </>
            )}
          </button>
        </div>
        <MobileSubtasks task={task} onOpenTask={onOpenTask} />
        <div className="px-4">
          <LinkedDocs task={task} />
        </div>
        <ActivitySection taskId={task.id} me={me} phone />
      </div>
      <BottomSheet open={actionsOpen} onOpenChange={setActionsOpen} label="Task actions">
        <BottomSheetOption
          icon={<IconLink aria-hidden className="size-[22px] text-icon" stroke={1.8} />}
          onClick={() => {
            setActionsOpen(false);
            onCopyLink();
          }}
        >
          Copy link
        </BottomSheetOption>
        {canConvert && (
          <BottomSheetOption
            icon={<IconCornerLeftUp aria-hidden className="size-[22px] text-icon" stroke={1.8} />}
            onClick={() => {
              setActionsOpen(false);
              onConvert();
            }}
          >
            Convert to task
          </BottomSheetOption>
        )}
        <BottomSheetOption
          destructive
          icon={<IconTrash aria-hidden className="size-[22px]" stroke={1.8} />}
          onClick={() => {
            setActionsOpen(false);
            onDelete();
          }}
        >
          Delete
        </BottomSheetOption>
      </BottomSheet>
      <DueDateSheet
        open={dueOpen}
        onOpenChange={setDueOpen}
        dueDate={task.dueDate}
        dueHasTime={task.dueHasTime}
        onChange={onEditTask}
      />
      <AssigneesSheet
        open={assigneesOpen}
        onOpenChange={setAssigneesOpen}
        members={members}
        assignees={task.assignees}
        meId={me.id}
        onChange={onSetAssignees}
      />
      <PrioritySheet
        open={priorityOpen}
        onOpenChange={setPriorityOpen}
        priority={task.priority}
        onChange={(priority) => onEditTask({ priority })}
      />
    </div>
  );
}