"use client";

import { useState } from "react";
import { ChartPie, Check, CircleCheck, CircleDashed } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StatusCategoryName, StatusDTO, TaskRowDTO } from "@/server/services/types";

/**
 * Status glyphs for rows and group pills (docs/design/list-view-*.jsx.txt), as lucide icons so
 * they pick up the theme tokens via currentColor / fill utilities (dark mode keeps working).
 */

/** One status's category icon, 14px — used by the status menu items. */
export function StatusGlyph({
  category,
  size = 18,
  pill = false,
}: {
  category: StatusCategoryName;
  size?: number;
  pill?: boolean;
}) {
  if (category === "DONE") {
    // Rows: a green disc with a white check; the done group's pill: white disc, green check.
    return (
      <CircleCheck
        size={size}
        strokeWidth={pill ? 2.5 : 2}
        aria-hidden
        className={pill ? "fill-white text-done" : "fill-done text-white"}
      />
    );
  }
  if (category === "ACTIVE") {
    return (
      <ChartPie
        size={size}
        strokeWidth={pill ? 2.5 : 2}
        aria-hidden
        className="text-status-active"
      />
    );
  }
  return (
    <CircleDashed
      size={size}
      strokeWidth={pill ? 2.5 : 2}
      aria-hidden
      className="text-muted-foreground"
    />
  );
}

/**
 * The row's status circle (ClickUp-style): opens the status menu instead of toggling done.
 * Picking the current status does nothing; moving into a DONE status with open subtasks
 * asks whether to complete them too (the same dialog the row menu's Complete uses).
 */
export function StatusControl({
  task,
  statuses,
  disabled,
  onSetStatus,
}: {
  task: TaskRowDTO;
  /** The project's statuses, in menu order. */
  statuses: readonly StatusDTO[];
  disabled?: boolean;
  onSetStatus: (task: TaskRowDTO, statusId: string, completeSubtasks?: boolean) => void;
}) {
  const done = task.completedAt !== null;
  const [open, setOpen] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  function pick(status: StatusDTO) {
    if (status.id === task.status.id) return;
    if (status.category === "DONE" && !done && task.openSubtaskCount > 0) {
      setPendingStatusId(status.id);
      return;
    }
    onSetStatus(task, status.id);
  }

  const pending = pendingStatusId ? statuses.find((s) => s.id === pendingStatusId) : null;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Status: ${task.status.name}`}
              disabled={disabled}
              className="shrink-0 disabled:pointer-events-none"
            />
          }
        >
          <StatusGlyph category={task.status.category} size={done ? 16 : 18} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {statuses.map((status) => (
              <DropdownMenuItem key={status.id} onClick={() => pick(status)}>
                <StatusGlyph category={status.category} size={14} />
                {status.name}
                {status.id === task.status.id && (
                  <Check className="ml-auto" aria-hidden />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPendingStatusId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Also complete {task.openSubtaskCount} open subtask
              {task.openSubtaskCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (pending) onSetStatus(task, pending.id);
                setPendingStatusId(null);
              }}
            >
              Only this task
            </AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              onClick={(e) => {
                e.preventDefault();
                if (pending) onSetStatus(task, pending.id, true);
                setPendingStatusId(null);
              }}
            >
              Complete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** The subtask glyph (branch with two circles) used next to subtask counts and parent lines. */
export function SubtaskGlyph({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      className={className}
    >
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 8.5V12a3 3 0 0 0 3 3h6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
