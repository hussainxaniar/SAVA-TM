"use client";

import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
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
import { cn } from "@/lib/utils";
import type { StatusCategoryName, StatusDTO, TaskRowDTO } from "@/server/services/types";

/*
 * Status glyphs from the Paper file's "Icons" page (artboard "Task Statuses"; docs/design/icons.md):
 * dashed circle, empty circle, quarter / half / three-quarter pies, and a filled disc with a
 * knocked-out check. Drawn in currentColor so theme tokens (and dark mode) apply.
 */

export type StatusGlyphKind = "dashed" | "empty" | "quarter" | "half" | "threeQuarter" | "done";

/**
 * Which glyph a status gets, from its place among the project's statuses (in menu order):
 * the first TODO status is dashed, later TODO statuses are empty circles; ACTIVE statuses fill
 * a pie by their position (one ACTIVE status = half; two = quarter, three-quarter; …); DONE is
 * the check. Unknown statuses fall back to their category's first glyph.
 */
export function statusGlyphKind(
  status: Pick<StatusDTO, "id" | "category"> & { icon?: string | null },
  statuses: readonly Pick<StatusDTO, "id" | "category">[],
): StatusGlyphKind {
  if (status.category === "DONE") return "done";
  // An ACTIVE status can choose its icon (status settings); otherwise it's picked by position below.
  if (status.category === "ACTIVE" && status.icon) {
    const chosen = { circle: "empty", quarter: "quarter", half: "half", threeQuarter: "threeQuarter" } as const;
    if (status.icon in chosen) return chosen[status.icon as keyof typeof chosen];
  }
  const same = statuses.filter((s) => s.category === status.category);
  const index = Math.max(0, same.findIndex((s) => s.id === status.id));
  if (status.category === "TODO") return index === 0 ? "dashed" : "empty";
  const quarters = Math.min(3, Math.max(1, Math.round(((index + 1) / (same.length + 1)) * 4)));
  return quarters === 1 ? "quarter" : quarters === 2 ? "half" : "threeQuarter";
}

const DASHED =
  "M8.777 10.158C9.323 9.793 9.793 9.323 10.158 8.777L10.573 9.056L10.574 9.056L10.657 9.111L10.988 9.333C10.55 9.987 9.987 10.55 9.333 10.988L9.308 10.95L9.056 10.574L9.056 10.573L8.777 10.158ZM11.885 4.829C11.96 5.208 12 5.599 12 6C12 6.4 11.96 6.791 11.885 7.17L11.396 7.074L11.396 7.073L10.905 6.977C10.968 6.662 11 6.335 11 6C11 5.665 10.968 5.338 10.905 5.023L11.396 4.926L11.885 4.829ZM0.114 4.829L0.604 4.926L0.604 4.926L1.095 5.023C1.032 5.338 1 5.665 1 6C1 6.335 1.032 6.662 1.095 6.977L0.604 7.073L0.604 7.074L0.114 7.17C0.039 6.792 0 6.4 0 6C0 5.599 0.039 5.208 0.114 4.829ZM2.666 1.011L2.929 1.403L3.223 1.842C2.677 2.207 2.207 2.677 1.842 3.223L1.011 2.666C1.449 2.012 2.012 1.449 2.666 1.011ZM2.944 10.574L2.692 10.95L2.666 10.988C2.012 10.55 1.449 9.987 1.011 9.333L1.842 8.777C2.207 9.323 2.677 9.793 3.223 10.158L2.943 10.573L2.944 10.574ZM4.924 0.595L4.829 0.114C5.208 0.039 5.599 0 6 0C6.4 0 6.792 0.039 7.17 0.114L7.076 0.595L6.977 1.095C6.662 1.032 6.335 1 6 1C5.665 1 5.338 1.032 5.023 1.095L4.924 0.595ZM9.333 1.011C9.987 1.449 10.55 2.012 10.988 2.666L10.158 3.223C9.793 2.677 9.323 2.207 8.777 1.842L9.071 1.403L9.333 1.011ZM6.977 10.905L7.073 11.396L7.074 11.396L7.156 11.812L7.17 11.885C6.791 11.96 6.4 12 6 12C5.599 12 5.208 11.96 4.829 11.885L5.023 10.905C5.338 10.968 5.665 11 6 11C6.335 11 6.662 10.968 6.977 10.905Z";
const DONE =
  "M6 0C9.314 0 12 2.686 12 6C12 9.314 9.314 12 6 12C2.686 12 0 9.314 0 6C0 2.686 2.686 0 6 0ZM9.333 3.5C9.223 3.5 9.117 3.544 9.039 3.622L5.167 7.494L3.378 5.705C3.299 5.629 3.194 5.588 3.085 5.589C2.976 5.59 2.871 5.634 2.794 5.711C2.717 5.788 2.673 5.893 2.672 6.002C2.671 6.111 2.713 6.216 2.789 6.295L4.872 8.378C4.95 8.456 5.057 8.5 5.167 8.5C5.277 8.5 5.383 8.456 5.461 8.378L9.628 4.211C9.706 4.133 9.75 4.027 9.75 3.917C9.75 3.807 9.706 3.7 9.628 3.622C9.55 3.544 9.443 3.5 9.333 3.5Z";
/** Pie wedges from 12 o'clock, clockwise; radius 6 = the outer edge of the ring (as in the design). */
const WEDGE: Partial<Record<StatusGlyphKind, string>> = {
  quarter: "M6 6V0A6 6 0 0 1 12 6Z",
  half: "M6 6V0A6 6 0 0 1 6 12Z",
  threeQuarter: "M6 6V0A6 6 0 1 1 0 6Z",
};

const CATEGORY_COLOR: Record<StatusCategoryName, string> = {
  TODO: "text-muted-foreground",
  ACTIVE: "text-status-active",
  DONE: "text-done",
};

/**
 * One status's glyph. Pass the project's statuses so the glyph reflects the status's place in
 * its category (see statusGlyphKind). `pill`: drawn on a status-group pill (the Done pill is
 * green, so its glyph is white).
 */
export function StatusGlyph({
  status,
  statuses,
  size = 18,
  pill = false,
  className,
}: {
  /** `color`: the status's own color (what the user picked in settings); without it the category's theme color is used. */
  status: Pick<StatusDTO, "id" | "category"> & { icon?: string | null; color?: string };
  statuses: readonly Pick<StatusDTO, "id" | "category">[];
  size?: number;
  pill?: boolean;
  className?: string;
}) {
  const kind = statusGlyphKind(status, statuses);
  const color = pill && status.category === "DONE" ? "text-white" : CATEGORY_COLOR[status.category];
  const wedge = WEDGE[kind];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={cn("shrink-0", color, className)}
      // The status's own color wins (a Done pill stays white on its green background).
      style={status.color && !(pill && status.category === "DONE") ? { color: status.color } : undefined}
    >
      {kind === "dashed" && <path d={DASHED} fill="currentColor" />}
      {kind === "done" && <path d={DONE} fill="currentColor" />}
      {kind !== "dashed" && kind !== "done" && (
        <circle cx="6" cy="6" r="5.5" stroke="currentColor" />
      )}
      {wedge && <path d={wedge} fill="currentColor" />}
    </svg>
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
  size,
  variant = "icon",
}: {
  task: TaskRowDTO;
  /** The project's statuses, in menu order. */
  statuses: readonly StatusDTO[];
  disabled?: boolean;
  onSetStatus: (task: TaskRowDTO, statusId: string, completeSubtasks?: boolean) => void;
  /** Glyph size (the "icon" variant's default is 18, 16 when done). */
  size?: number;
  /** "pill" renders the trigger as the task dialog's status pill (9.4.6). */
  variant?: "icon" | "pill";
}) {
  const done = task.completedAt !== null;
  const glyphSize = size ?? (done ? 16 : 18);
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
            variant === "pill" ? (
              <button
                type="button"
                aria-label={`Status: ${task.status.name}`}
                disabled={disabled}
                className={cn(
                  "flex h-[26px] w-fit shrink-0 items-center gap-2 rounded-md pl-2 pr-2.5 disabled:pointer-events-none",
                  done ? "bg-done text-white" : "bg-pill text-foreground/80",
                )}
              />
            ) : (
              <button
                type="button"
                aria-label={`Status: ${task.status.name}`}
                disabled={disabled}
                // flex: an inline button leaves its text line-height under the icon, which sat the glyph ~3px above the title's centre
                className="flex shrink-0 disabled:pointer-events-none"
              />
            )
          }
        >
          {variant === "pill" && (
            <StatusGlyph status={task.status} statuses={statuses} size={14} pill />
          )}
          {variant === "pill" && (
            <span className="text-xs font-semibold uppercase tracking-[0.04em]">
              {task.status.name}
            </span>
          )}
          {variant === "icon" && (
            <StatusGlyph status={task.status} statuses={statuses} size={glyphSize} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {statuses.map((status) => (
              <DropdownMenuItem key={status.id} onClick={() => pick(status)}>
                <StatusGlyph status={status} statuses={statuses} size={14} />
                {status.name}
                {status.id === task.status.id && (
                  <IconCheck className="ml-auto" aria-hidden />
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

/**
 * The subtask glyph from the Paper "Icons" page (artboard "Subtask"): two small circles joined
 * by an elbow. Used next to subtask counts and parent lines.
 */
export function SubtaskGlyph({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="1 1 14 14"
      fill="none"
      stroke="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M5 6.5C5.828 6.5 6.5 5.828 6.5 5 6.5 4.172 5.828 3.5 5 3.5 4.172 3.5 3.5 4.172 3.5 5 3.5 5.828 4.172 6.5 5 6.5Z" />
      <path d="M5 7V9C5 10.104 5.896 11 7 11H9" strokeLinecap="square" />
      <path d="M11 12.5C11.828 12.5 12.5 11.828 12.5 11 12.5 10.172 11.828 9.5 11 9.5 10.172 9.5 9.5 10.172 9.5 11 9.5 11.828 10.172 12.5 11 12.5Z" />
    </svg>
  );
}
