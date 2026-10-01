"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "timeGridWeek", label: "Week" },
  { id: "timeGridDay", label: "Day" },
  { id: "dayGridMonth", label: "Month" },
];

type CalendarToolbarProps = {
  title: string;
  view: string;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onView: (view: string) => void;
};

/** The header band's second row (10.1): Today, ‹ ›, the range title and the Week | Day | Month toggle. */
export function CalendarToolbar({ title, view, onToday, onPrev, onNext, onView }: CalendarToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={onToday}>
        Today
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Previous" onClick={onPrev}>
        <IconChevronLeft aria-hidden />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={onNext}>
        <IconChevronRight aria-hidden />
      </Button>
      <h2 className="ml-1 text-[15px] font-semibold text-foreground">{title}</h2>
      <div className="ml-auto flex shrink-0 rounded-md bg-pill p-0.5">
        {VIEWS.map((v) => (
          <ViewButton key={v.id} label={v.label} active={view === v.id} onClick={() => onView(v.id)} />
        ))}
      </div>
    </div>
  );
}

/** Same segmented style as the dialog's All | Comments toggle. */
function ViewButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-[5px] px-3 py-[3px] text-xs leading-4",
        active ? "bg-background font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
