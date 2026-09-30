"use client";

import { useMemo, useState } from "react";
import { IconCornerLeftUp, IconDots } from "@tabler/icons-react";
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
import { MakeSubtaskDialog } from "@/components/tasks/make-subtask-dialog";
import { SubtaskGlyph } from "@/components/tasks/status-icon";
import type { Priority, StatusDTO, TaskRowDTO } from "@/server/services/types";

/**
 * The row's `⋯` menu (hover button and right-click share it). Priority is a radio submenu; the
 * current value shows a check via the radio item's indicator. The re-parenting items (6.4.3)
 * open the "Make subtask of…" picker; candidates are computed only while a menu or picker is open.
 */
export function TaskRowMenu({
  task,
  open,
  onOpenChange,
  onOpenTask,
  onComplete,
  onSetPriority,
  onDeleteTask,
  onMakeSubtaskOf,
  onConvertToTask,
  candidatesFor,
  statuses,
}: {
  task: TaskRowDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTask: (taskId: string) => void;
  onComplete: (task: TaskRowDTO, opts: { completed: boolean; includeSubtasks?: boolean }) => void;
  onSetPriority: (taskId: string, priority: Priority) => void;
  onDeleteTask: (task: TaskRowDTO) => void;
  onMakeSubtaskOf: (task: TaskRowDTO, parentId: string) => void;
  onConvertToTask: (task: TaskRowDTO) => void;
  /** Valid parents for a task id (parentCandidates); computed on demand. */
  candidatesFor: (taskId: string) => TaskRowDTO[];
  statuses: readonly StatusDTO[];
}) {
  const done = task.completedAt !== null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const candidates = useMemo(
    () => (open || pickerOpen ? candidatesFor(task.id) : []),
    [open, pickerOpen, candidatesFor, task.id],
  );

  return (
    <>
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
          <IconDots className="size-3.5" />
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
            {candidates.length > 0 && (
              <DropdownMenuItem
                onClick={() => {
                  onOpenChange(false);
                  setPickerOpen(true);
                }}
              >
                <SubtaskGlyph size={16} />
                Make subtask of…
              </DropdownMenuItem>
            )}
            {task.parentId !== null && (
              <DropdownMenuItem onClick={() => onConvertToTask(task)}>
                <IconCornerLeftUp aria-hidden />
                Convert to task
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={() => onDeleteTask(task)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <MakeSubtaskDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        candidates={candidates}
        statuses={statuses}
        onPick={(parentId) => onMakeSubtaskOf(task, parentId)}
      />
    </>
  );
}