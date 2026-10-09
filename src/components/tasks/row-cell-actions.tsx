"use client";

import { IconCalendarPlus, IconFlag, IconUserPlus } from "@tabler/icons-react";
import { AssigneePicker } from "@/components/task-dialog/assignee-picker";
import { DatePicker } from "@/components/task-dialog/date-picker";
import { AvatarStack } from "@/components/tasks/avatar-stack";
import { PRIORITY_META, PriorityFlag } from "@/components/tasks/priority-flag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSpaceMembers } from "@/hooks/use-space-members";
import { localDayOf } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import type { Priority, TaskRowDTO, UserLite } from "@/server/services/types";

/*
 * The nested row's Assignee / Due / Priority cells as quick actions (9.2): a filled cell opens
 * its picker, an empty one shows a faint add icon once the row is hovered or focused. The
 * portaled contents stop clicks, pointer-downs and keys from bubbling back into the row (which
 * would open the task or start a drag); the triggers keep their pointer-downs so the row still
 * drags from anywhere.
 */

const hoverReveal = "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100";

const stopRowBubble = {
  onClick: (e: React.MouseEvent) => e.stopPropagation(),
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
};

export function AssigneeCell({
  task,
  onToggle,
}: {
  task: TaskRowDTO;
  onToggle: (task: TaskRowDTO, member: UserLite) => void;
}) {
  const members = useSpaceMembers();
  return (
    <div className="hidden w-[72px] shrink-0 items-center self-stretch md:flex">
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Assignees"
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-full items-center justify-start"
            />
          }
        >
          {task.assignees.length > 0 ? (
            <AvatarStack users={task.assignees} />
          ) : (
            <IconUserPlus size={16} aria-hidden className={cn("shrink-0 text-muted-foreground", hoverReveal)} />
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-1" {...stopRowBubble}>
          <AssigneePicker
            members={members}
            assignees={task.assignees}
            onToggle={(member) => onToggle(task, member)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function DueCell({
  task,
  label,
  className,
  onSetDue,
}: {
  task: TaskRowDTO;
  /** The already computed due label and tone class (formatDue), or null when there is none. */
  label?: string | null;
  className?: string | null;
  onSetDue: (task: TaskRowDTO, day: Date | null) => void;
}) {
  return (
    <div className="w-24 shrink-0 self-stretch">
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Due date"
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-full items-center justify-start text-[13px]"
            />
          }
        >
          {label ? (
            <span className={cn("min-w-0 truncate", className)}>{label}</span>
          ) : (
            <IconCalendarPlus size={16} aria-hidden className={cn("shrink-0 text-muted-foreground", hoverReveal)} />
          )}
        </PopoverTrigger>
        <PopoverContent className="w-[264px] p-2" {...stopRowBubble}>
          <DatePicker
            day={task.dueDate ? localDayOf(task.dueDate, false) : null}
            time={null}
            allowTime={false}
            onChange={(day) => onSetDue(task, day)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function PriorityCell({
  task,
  onSetPriority,
}: {
  task: TaskRowDTO;
  onSetPriority: (taskId: string, priority: Priority) => void;
}) {
  return (
    <div className="flex w-8 shrink-0 justify-center self-stretch">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Priority"
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-full items-center justify-center"
            />
          }
        >
          {task.priority < 4 ? (
            <PriorityFlag priority={task.priority} />
          ) : (
            <IconFlag size={14} aria-hidden className={cn("text-muted-foreground", hoverReveal)} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" {...stopRowBubble}>
          <DropdownMenuRadioGroup
            value={String(task.priority)}
            onValueChange={(v) => onSetPriority(task.id, Number(v) as Priority)}
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
    </div>
  );
}