"use client";

import { IconCalendar, IconClock, IconList, IconPlus, IconX } from "@tabler/icons-react";
import { formatDue, type DueTone } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/tasks/avatar-stack";
import { PriorityFlag } from "@/components/tasks/priority-flag";
import { StatusControl } from "@/components/tasks/status-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskDetailDTO } from "@/server/services/types";

const TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-overdue",
  today: "text-success",
  default: "",
};

/**
 * The dialog's right column (9.4.6): 320px, panel background, sections under 13px semibold
 * titles. Read-only in T-11 except Status — editing arrives in T-13/T-14/T-17.
 */
export function PropertiesColumn({
  task,
  onSetStatus,
  onAddToList,
  onRemoveFromList,
}: {
  task: TaskDetailDTO;
  onSetStatus: (task: { id: string }, statusId: string, completeSubtasks?: boolean) => void;
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

      <Section title="Assignees">
        {task.assignees.length === 0 ? (
          <Empty>No one</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {task.assignees.map((user) => (
              <div key={user.id} className="flex items-center gap-2.5">
                <Avatar user={user} className="size-5" />
                <span className="text-sm">{user.name}</span>
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
            value={start ? start.label : undefined}
          />
          <DateRow
            icon={
              <IconCalendar
                aria-hidden
                className={cn("size-4 shrink-0", due ? TONE_CLASS[due.tone] : "text-muted-foreground")}
              />
            }
            label="Due"
            value={due?.label}
            tone={due?.tone}
          />
        </div>
      </Section>

      <Section title="Priority">
        {task.priority === 4 ? (
          <Empty>None</Empty>
        ) : (
          <div className="flex items-center gap-2.5">
            <PriorityFlag priority={task.priority} size={16} />
            <span className="text-sm">P{task.priority}</span>
          </div>
        )}
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

      <Section title="Scheduled">
        {task.timeBlocks.length === 0 ? (
          <Empty>Nothing scheduled</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {task.timeBlocks.map((block) => (
              <div key={block.id} className="flex items-center gap-2.5">
                <IconClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm">{blockLabel(block.start, block.end)}</span>
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
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
  tone?: DueTone;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="w-14 shrink-0 text-sm text-muted-foreground">{label}</span>
      {value ? (
        <span className={cn("text-sm", tone && TONE_CLASS[tone], tone && tone !== "default" && "font-medium")}>
          {value}
        </span>
      ) : (
        <Empty>None</Empty>
      )}
    </div>
  );
}
