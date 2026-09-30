"use client";

import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRIORITY_META, PriorityFlag } from "@/components/tasks/priority-flag";
import type { Priority, TaskRowDTO } from "@/server/services/types";

/**
 * The row's `⋯` menu (hover button and right-click share it). Priority is a radio submenu; the
 * current value shows a check via the radio item's indicator.
 */
export function TaskRowMenu({
  task,
  open,
  onOpenChange,
  onOpenTask,
  onComplete,
  onSetPriority,
  onDeleteTask,
}: {
  task: TaskRowDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTask: (taskId: string) => void;
  onComplete: (task: TaskRowDTO, opts: { completed: boolean; includeSubtasks?: boolean }) => void;
  onSetPriority: (taskId: string, priority: Priority) => void;
  onDeleteTask: (task: TaskRowDTO) => void;
}) {
  const done = task.completedAt !== null;
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Task actions"
            className="flex size-[26px] items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-sidebar"
          />
        }
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onOpenTask(task.id)}>Open</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onComplete(task, { completed: !done })}
          >
            {done ? "Reopen" : "Complete"}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Priority</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
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
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onDeleteTask(task)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
