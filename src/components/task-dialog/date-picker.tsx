"use client";

import { useState, type ReactNode } from "react";
import { IconChevronLeft, IconChevronRight, IconClock, IconX } from "@tabler/icons-react";
import { monthGrid, quickDays, sameDay } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import { PopoverClose } from "@/components/ui/popover";

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HEADINGS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * The calendar inside a PopoverContent (9.4.6 dates): quick picks, a Monday-first month grid
 * and, for due dates, an optional local time. `day` is a local day at 00:00 (or null); `time`
 * is "HH:mm" (or null). Picking a day closes the popover unless a time can still be added
 * next (allowTime) or the caller keeps it open (closeOnPick={false}).
 */
export function DatePicker({
  day,
  time,
  allowTime,
  onChange,
  closeOnPick = !allowTime,
  showClear = true,
}: {
  day: Date | null;
  time: string | null;
  allowTime: boolean;
  onChange: (day: Date | null, time: string | null) => void;
  /** Close the surrounding popover when a day is picked (default: when there's no time step). */
  closeOnPick?: boolean;
  /** The "Clear" button (off when the picker is one field of a larger form). */
  showClear?: boolean;
}) {
  // The month starts at the selected day's month, else today's.
  const [view, setView] = useState(() => {
    const base = day ?? new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const [addingTime, setAddingTime] = useState(false);
  const today = new Date();
  const cells = monthGrid(view.y, view.m);
  const showTime = time !== null || addingTime;

  // Without a time step to follow, picking a day also closes the popover.
  const pick = (key: string, className: string, onClick: () => void, children: ReactNode) =>
    !closeOnPick ? (
      <button key={key} type="button" className={className} onClick={onClick}>
        {children}
      </button>
    ) : (
      <PopoverClose key={key} render={<button type="button" className={className} />} onClick={onClick}>
        {children}
      </PopoverClose>
    );

  return (
    <div className="flex flex-col">
      {quickDays().map((q) =>
        pick(
          q.label,
          "flex h-8 w-full items-center justify-between rounded-md px-1.5 text-sm hover:bg-accent",
          () => onChange(q.day, time),
          <>
            <span>{q.label}</span>
            <span className="text-xs text-muted-foreground">{WEEKDAYS_SHORT[q.day.getDay()]}</span>
          </>,
        ),
      )}

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold leading-4">
          {MONTHS_LONG[view.m]} {view.y}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setView(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <IconChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setView(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <IconChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-7">
        {HEADINGS.map((h) => (
          <span
            key={h}
            className="flex h-8 items-center justify-center text-[11px] text-muted-foreground"
          >
            {h}
          </span>
        ))}
        {cells.map((d, i) => {
          const selected = day !== null && sameDay(d, day);
          return (
            <div key={i} className="flex justify-center">
              {pick(
                "day",
                cn(
                  "flex size-8 items-center justify-center rounded-md text-[13px]",
                  selected
                    ? "bg-primary text-primary-foreground hover:bg-primary"
                    : "hover:bg-accent",
                  d.getMonth() !== view.m && "text-muted-foreground",
                  sameDay(d, today) && "ring-1 ring-primary/40",
                ),
                () => onChange(d, time),
                d.getDate(),
              )}
            </div>
          );
        })}
      </div>

      {allowTime &&
        (showTime ? (
          <div className="mt-1.5 flex items-center gap-1">
            <input
              type="time"
              value={time ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) onChange(day ?? new Date(), v);
                else onChange(day, null);
              }}
              className="h-8 min-w-0 flex-1 rounded-md border px-2 text-sm"
            />
            <button
              type="button"
              aria-label="Remove time"
              onClick={() => {
                setAddingTime(false);
                onChange(day, null);
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <IconX aria-hidden className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingTime(true)}
            className="mt-1.5 flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm text-muted-foreground hover:bg-accent"
          >
            <IconClock aria-hidden className="size-4" />
            Add time
          </button>
        ))}

      {showClear && (
        <PopoverClose
          render={
            <button
              type="button"
              className="mt-1.5 flex h-8 items-center rounded-md px-1.5 text-sm text-muted-foreground hover:bg-accent"
            />
          }
          onClick={() => onChange(null, null)}
        >
          Clear
        </PopoverClose>
      )}
    </div>
  );
}