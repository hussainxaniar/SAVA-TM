"use client";

import { useState } from "react";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconFlag,
  IconSearch,
} from "@tabler/icons-react";
import { Avatar } from "@/components/tasks/avatar-stack";
import { PriorityFlag } from "@/components/tasks/priority-flag";
import { BottomSheet, BottomSheetAction, BottomSheetOption } from "@/components/ui/bottom-sheet";
import {
  dateOnlyFromLocal,
  localDayOf,
  localTimeOf,
  monthGrid,
  quickDays,
  sameDay,
  withLocalTime,
} from "@/lib/list-view";
import { cn } from "@/lib/utils";
import type { Priority, UserLite } from "@/server/services/types";

/*
 * The task's property pickers on a phone (docs/design/mobile/03-task-pickers): due date with a
 * quick chips row, a month grid and a time field; assignees with a search field; priority. Each
 * is a bottom sheet; every edit applies at once, so the chips in the task body update live.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The Due date sheet: quick chips (Today, Tomorrow, Next week, No date), a two-month-scrollable
 * grid where picking a day applies it and keeps the sheet open, and a time field. A day pick
 * keeps the time; setting or clearing the time keeps the day.
 */
export function DueDateSheet({
  open,
  onOpenChange,
  dueDate,
  dueHasTime,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dueDate: string | null;
  dueHasTime: boolean;
  onChange: (edit: { dueDate: string | null; dueHasTime?: boolean }) => void;
}) {
  const today = new Date();
  const selected = dueDate ? localDayOf(dueDate, dueHasTime) : null;
  // The month being shown starts on the selected day (or today); closed, the choice is forgotten
  // so the next open starts on the task's day again.
  const [navigated, setNavigated] = useState<{ y: number; m: number } | null>(null);
  if (!open && navigated !== null) setNavigated(null);
  const anchor = selected ?? today;
  const view = navigated ?? { y: anchor.getFullYear(), m: anchor.getMonth() };

  const time = dueHasTime && dueDate ? localTimeOf(dueDate) : "";

  const applyDay = (day: Date) => {
    if (time) onChange({ dueDate: withLocalTime(day, time), dueHasTime: true });
    else onChange({ dueDate: dateOnlyFromLocal(day) });
  };

  const quick = quickDays(today).slice(0, 3);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Due date"
      action={<BottomSheetAction onClick={() => onOpenChange(false)}>Done</BottomSheetAction>}
    >
      <div className="flex gap-2 px-4 pb-3 pt-1">
        {quick.map(({ label, day }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              applyDay(day);
              onOpenChange(false);
            }}
            className={cn(
              "h-8 rounded-lg border border-border px-2.5 text-[13px] font-medium",
              selected && sameDay(day, selected)
                ? "border-transparent bg-selected text-selected-foreground"
                : "text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            onChange({ dueDate: null });
            onOpenChange(false);
          }}
          className={cn(
            "h-8 rounded-lg border border-border px-2.5 text-[13px] font-medium",
            selected === null
              ? "border-transparent bg-selected text-selected-foreground"
              : "text-foreground",
          )}
        >
          No date
        </button>
      </div>
      <div className="flex h-11 items-center border-t border-divider pl-4 pr-1">
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-foreground">
          {MONTH_NAMES[view.m]} {view.y}
        </span>
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => {
            const m = view.m === 0 ? 11 : view.m - 1;
            setNavigated({ y: view.m === 0 ? view.y - 1 : view.y, m });
          }}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <IconChevronLeft aria-hidden className="size-[22px] text-icon" stroke={2} />
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => {
            const m = view.m === 11 ? 0 : view.m + 1;
            setNavigated({ y: view.m === 11 ? view.y + 1 : view.y, m });
          }}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <IconChevronRight aria-hidden className="size-[22px] text-icon" stroke={2} />
        </button>
      </div>
      <div className="grid grid-cols-7 px-3 text-center text-xs leading-4 text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <span key={i} aria-hidden>
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 px-3">
        {monthGrid(view.y, view.m).map((day) => {
          const outside = day.getMonth() !== view.m;
          const isSelected = selected !== null && sameDay(day, selected);
          const isToday = sameDay(day, today);
          return (
            <button
              key={day.getTime()}
              type="button"
              aria-pressed={isSelected || undefined}
              aria-label={day.toDateString()}
              onClick={() => applyDay(day)}
              className={cn(
                "flex h-11 items-center justify-center text-[15px]",
                isSelected
                  ? ""
                  : isToday
                    ? "font-semibold text-primary"
                    : outside
                      ? "text-faint"
                      : "text-foreground",
              )}
            >
              {isSelected ? (
                <span className="flex size-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {day.getDate()}
                </span>
              ) : (
                day.getDate()
              )}
            </button>
          );
        })}
      </div>
      <div className="flex h-[52px] items-center gap-3 border-t border-divider px-4">
        <IconClock aria-hidden className="size-5 shrink-0 text-icon" stroke={2} />
        <span className="min-w-0 flex-1 text-base text-foreground">Time</span>
        <input
          type="time"
          aria-label="Time"
          value={time}
          onChange={(e) => {
            const day = selected ?? today;
            if (e.target.value) onChange({ dueDate: withLocalTime(day, e.target.value), dueHasTime: true });
            else onChange({ dueDate: dateOnlyFromLocal(day), dueHasTime: false });
          }}
          className="bg-transparent text-base text-foreground outline-none"
        />
      </div>
    </BottomSheet>
  );
}

/**
 * The Assignees sheet: a search field over the space's members and a row per member; a tap
 * toggles — removes an assignee or appends one at the end. "Done" closes.
 */
export function AssigneesSheet({
  open,
  onOpenChange,
  members,
  assignees,
  meId,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: UserLite[];
  assignees: UserLite[];
  meId: string;
  onChange: (assignees: UserLite[]) => void;
}) {
  const [query, setQuery] = useState("");
  if (!open && query !== "") setQuery("");
  const shown = members.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()));

  const toggle = (member: UserLite) => {
    if (assignees.some((a) => a.id === member.id)) {
      onChange(assignees.filter((a) => a.id !== member.id));
    } else {
      onChange([...assignees, member]);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Assignees"
      action={<BottomSheetAction onClick={() => onOpenChange(false)}>Done</BottomSheetAction>}
    >
      <div className="mx-4 mb-2 mt-1 flex h-10 items-center gap-2 rounded-[10px] bg-pill px-3">
        <IconSearch aria-hidden className="size-[18px] shrink-0 text-muted-foreground" stroke={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people"
          aria-label="Search people"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {shown.map((member) => {
        const assigned = assignees.some((a) => a.id === member.id);
        return (
          <button
            key={member.id}
            type="button"
            aria-pressed={assigned}
            onClick={() => toggle(member)}
            className="flex h-14 w-full items-center gap-3 px-4 text-left"
          >
            <Avatar user={member} className="size-8 text-xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base text-foreground">{member.name}</span>
              {member.id === meId && <span className="block text-xs leading-4 text-muted-foreground">You</span>}
            </span>
            {assigned && <IconCheck aria-hidden className="size-[22px] shrink-0 text-primary" strokeWidth={2.2} />}
          </button>
        );
      })}
    </BottomSheet>
  );
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 1, label: "P1 · Urgent" },
  { value: 2, label: "P2 · High" },
  { value: 3, label: "P3 · Medium" },
  { value: 4, label: "No priority" },
];

/** The Priority sheet: P1–P3 with their flag, "No priority" last. A pick applies it and closes. */
export function PrioritySheet({
  open,
  onOpenChange,
  priority,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priority: Priority;
  onChange: (priority: Priority) => void;
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Priority">
      {PRIORITY_OPTIONS.map((option) => (
        <BottomSheetOption
          key={option.value}
          selected={option.value === priority}
          icon={
            option.value === 4 ? (
              <IconFlag aria-hidden className="size-[22px] text-faint" stroke={2} />
            ) : (
              <PriorityFlag priority={option.value} size={22} />
            )
          }
          onClick={() => {
            onOpenChange(false);
            onChange(option.value);
          }}
        >
          {option.label}
        </BottomSheetOption>
      ))}
    </BottomSheet>
  );
}