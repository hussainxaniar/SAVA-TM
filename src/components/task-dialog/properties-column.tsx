"use client";

import { IconAlertTriangle, IconCalendar, IconClock, IconRefresh, IconList, IconPlus, IconX } from "@tabler/icons-react";
import {
  dateOnlyFromLocal,
  formatDue,
  localDayOf,
  localTimeOf,
  withLocalTime,
  type DueTone,
} from "@/lib/list-view";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/tasks/avatar-stack";
import { PRIORITY_META, PriorityFlag } from "@/components/tasks/priority-flag";
import { StatusControl } from "@/components/tasks/status-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDeleteTimeBlock, useGoogleConnection, useRetrySync } from "@/hooks/use-calendar";
import type { TaskEdit } from "@/hooks/use-task";
import type { Priority, TaskDetailDTO, UserLite } from "@/server/services/types";
import { AssigneePicker } from "./assignee-picker";
import { DatePicker } from "./date-picker";
import { SchedulePopover } from "./schedule-popover";

const TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-overdue",
  today: "text-success",
  default: "",
};

const DATE_TRIGGER_CLASS = "-mx-1 rounded-md px-1 text-left text-sm hover:bg-sidebar-accent";

/**
 * The dialog's right column (9.4.6): 320px, panel background, sections under 13px semibold
 * titles. Assignees toggle through the member picker, Start/Due open the date picker and
 * priority is a radio menu; edits are optimistic via the dialog's hooks.
 */
export function PropertiesColumn({
  task,
  members,
  me,
  onSetStatus,
  onSetAssignees,
  onEditTask,
  onAddToList,
  onRemoveFromList,
}: {
  task: TaskDetailDTO;
  /** Current space members, for the Assignees picker (6.8). */
  members: UserLite[];
  /** The signed-in user: only own time blocks can be removed (10.1). */
  me: UserLite;
  onSetStatus: (task: { id: string }, statusId: string, completeSubtasks?: boolean) => void;
  /** Replaces the assignees with the full new list (6.8). */
  onSetAssignees: (assignees: UserLite[]) => void;
  /** Field edits without the taskId (dates, priority). */
  onEditTask: (edit: Omit<TaskEdit, "taskId">) => void;
  onAddToList: (listId: string) => void;
  onRemoveFromList: (listId: string) => void;
}) {
  const start = task.startDate
    ? formatDue(task.startDate, false)
    : null;
  const due = task.dueDate
    ? formatDue(task.dueDate, task.dueHasTime, { completed: task.completedAt !== null })
    : null;
  // Addable lists (6.6): the project's active lists except home and the linked ones.
  const addTargets = task.project.lists.filter(
    (l) => l.id !== task.homeList.id && !task.linkedListIds.includes(l.id),
  );
  const deleteTimeBlock = useDeleteTimeBlock(task.spaceId);
  const retrySync = useRetrySync(task.spaceId);
  const google = useGoogleConnection().data ?? { connected: false };

  // Toggling keeps the current order; a newly assigned member goes to the end (6.8).
  const toggleAssignee = (member: UserLite) =>
    onSetAssignees(
      task.assignees.some((a) => a.id === member.id)
        ? task.assignees.filter((a) => a.id !== member.id)
        : [...task.assignees, member],
    );

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-divider bg-panel px-6 pt-2">
      <Section title="Status">
        <StatusControl
          task={task}
          statuses={task.statuses}
          variant="pill"
          onSetStatus={onSetStatus}
        />
      </Section>

      <Section
        title="Assignees"
        action={
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Edit assignees"
                  className="-mr-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent"
                />
              }
            >
              <IconPlus className="size-4" aria-hidden />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <AssigneePicker
                members={members}
                assignees={task.assignees}
                onToggle={toggleAssignee}
              />
            </PopoverContent>
          </Popover>
        }
      >
        {task.assignees.length === 0 ? (
          <Empty>No one</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {task.assignees.map((user) => (
              <div key={user.id} className="group/assignee flex items-center gap-2.5">
                <Avatar user={user} className="size-5" />
                <span className="min-w-0 flex-1 truncate text-sm">{user.name}</span>
                <button
                  type="button"
                  aria-label={`Unassign ${user.name}`}
                  onClick={() => onSetAssignees(task.assignees.filter((a) => a.id !== user.id))}
                  className="-mr-1 flex size-5 items-center justify-center rounded-sm text-muted-foreground/70 opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/assignee:opacity-100"
                >
                  <IconX className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Dates">
        <div className="flex flex-col gap-2">
          <DateRow
            icon={<IconCalendar aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
            label="Start"
          >
            <Popover>
              <PopoverTrigger render={<button type="button" className={DATE_TRIGGER_CLASS} />}>
                {start ? start.label : <span className="text-muted-foreground">None</span>}
              </PopoverTrigger>
              <PopoverContent className="w-[264px] p-2">
                <DatePicker
                  day={task.startDate ? localDayOf(task.startDate, false) : null}
                  time={null}
                  allowTime={false}
                  onChange={(day) =>
                    onEditTask({ startDate: day ? dateOnlyFromLocal(day) : null })
                  }
                />
              </PopoverContent>
            </Popover>
          </DateRow>
          <DateRow
            icon={
              <IconCalendar
                aria-hidden
                className={cn("size-4 shrink-0", due && due.tone !== "default" ? TONE_CLASS[due.tone] : "text-muted-foreground")}
              />
            }
            label="Due"
          >
            <Popover>
              <PopoverTrigger render={<button type="button" className={DATE_TRIGGER_CLASS} />}>
                {due ? (
                  <span className={cn(TONE_CLASS[due.tone], due.tone !== "default" && "font-medium")}>
                    {due.label}
                  </span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-[264px] p-2">
                <DatePicker
                  day={task.dueDate ? localDayOf(task.dueDate, task.dueHasTime) : null}
                  time={task.dueDate && task.dueHasTime ? localTimeOf(task.dueDate) : null}
                  allowTime
                  onChange={(day, time) => {
                    if (!day) onEditTask({ dueDate: null });
                    else if (time)
                      onEditTask({ dueDate: withLocalTime(day, time), dueHasTime: true });
                    else onEditTask({ dueDate: dateOnlyFromLocal(day), dueHasTime: false });
                  }}
                />
              </PopoverContent>
            </Popover>
          </DateRow>
        </div>
      </Section>

      <Section title="Priority">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="-mx-1 flex items-center gap-2.5 rounded-md px-1 hover:bg-sidebar-accent"
              />
            }
          >
            {task.priority === 4 ? (
              <span className="text-sm text-muted-foreground">None</span>
            ) : (
              <>
                <PriorityFlag priority={task.priority} size={16} />
                <span className="text-sm">P{task.priority}</span>
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-32">
            <DropdownMenuRadioGroup
              value={String(task.priority)}
              onValueChange={(v) => onEditTask({ priority: Number(v) as Priority })}
            >
              {PRIORITY_META.map((p) => (
                <DropdownMenuRadioItem key={p.value} value={String(p.value)} closeOnClick>
                  <PriorityFlag priority={p.value} />
                  {p.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section
        title="Lists"
        action={
          addTargets.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Add to list"
                    className="-mr-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent"
                  />
                }
              >
                <IconPlus className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {addTargets.map((list) => (
                  <DropdownMenuItem key={list.id} onClick={() => onAddToList(list.id)}>
                    <IconList aria-hidden />
                    {list.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-pill px-2.5 py-[3px] text-[13px]">{task.homeList.name}</span>
          {task.linkedLists.map((list) => (
            <span
              key={list.id}
              className="flex items-center gap-1 rounded-md border px-2.5 py-[3px] text-[13px] text-muted-foreground"
            >
              {list.name}
              <button
                type="button"
                aria-label={`Remove from ${list.name}`}
                onClick={() => onRemoveFromList(list.id)}
                className="-mr-0.5 flex items-center rounded-sm text-muted-foreground/70 hover:text-foreground"
              >
                <IconX className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      </Section>

      <Section title="Scheduled" action={<SchedulePopover task={task} />}>
        {task.timeBlocks.length === 0 ? (
          <Empty>Nothing scheduled</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {task.timeBlocks.map((block) => (
              <div key={block.id} className="group/block flex items-center gap-2.5">
                <IconClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{blockLabel(block.start, block.end)}</span>
                {google.connected && block.userId === me.id && (
                  <BlockSync
                    state={block.syncState}
                    onRetry={() => retrySync.mutate({ timeBlockId: block.id, taskId: task.id })}
                  />
                )}
                {block.userId === me.id && (
                  <button
                    type="button"
                    aria-label="Remove from calendar"
                    onClick={() => deleteTimeBlock.mutate({ timeBlockId: block.id, taskId: task.id })}
                    className="-mr-1 flex size-5 items-center justify-center rounded-sm text-muted-foreground/70 opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/block:opacity-100"
                  >
                    <IconX className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </aside>
  );
}

/** "Today 10:45–12:00": the day label of the start (Today / Tomorrow / "Oct 3"), then local times. */
function blockLabel(start: string, end: string): string {
  const day = formatDue(start, false).label;
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} ${time(start)}–${time(end)}`;
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  /** Small control at the right of the title row (e.g. Lists' `+`). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border pb-3 pt-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold leading-4 text-foreground/75">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function DateRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="w-14 shrink-0 text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Google sync state of one of my blocks (the design's ↻): synced, pending, or failed with Retry. */
function BlockSync({ state, onRetry }: { state: string; onRetry: () => void }) {
  if (state === "ERROR")
    return (
      <button
        type="button"
        onClick={onRetry}
        title="Google Calendar sync failed. Retry"
        aria-label="Retry Google Calendar sync"
        className="flex size-5 items-center justify-center rounded-sm text-overdue hover:bg-sidebar-accent"
      >
        <IconAlertTriangle className="size-3.5" aria-hidden />
      </button>
    );
  if (state === "PENDING") return <IconClock aria-label="Syncing to Google Calendar" className="size-3.5 shrink-0 text-muted-foreground" />;
  return <IconRefresh aria-label="Synced to Google Calendar" className="size-3.5 shrink-0 text-muted-foreground" />;
}
