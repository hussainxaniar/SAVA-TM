"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { DatesSetArg } from "@fullcalendar/core";
import type FullCalendar from "@fullcalendar/react";
import { IconCircleCheck, IconDots } from "@tabler/icons-react";
import { THREE_DAY_VIEW, CalendarGrid, type BlockTap } from "@/components/calendar/calendar-grid";
import { BottomSheet, BottomSheetOption } from "@/components/ui/bottom-sheet";
import { useCalendarTasks, type Range } from "@/hooks/use-calendar";
import { swipeDirection } from "@/lib/swipe";
import { CalendarBlockSheet } from "./calendar-block-sheet";
import { CalendarTasksPanel } from "./calendar-tasks-panel";
import { HeaderIconButton } from "./screen-header";

/*
 * The phone's Calendar tab (docs/design/mobile.md, Calendar): a 52px header (month, Today,
 * view sheet), the 3-day grid, a "See tasks" pill that opens the drag panel, and swipe to
 * change days. Blocks are created by long-pressing a task in the panel and dropping it on a
 * slot; tapping one of my blocks opens its detail sheet.
 */

export function MobileCalendarView({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [month, setMonth] = useState("");
  const [viewType, setViewType] = useState(THREE_DAY_VIEW);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [block, setBlock] = useState<BlockTap | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const { data: tasks } = useCalendarTasks(spaceId, null);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);

  const onDatesSet = useCallback((arg: DatesSetArg) => {
    const start = arg.start.toISOString();
    const end = arg.end.toISOString();
    setRange((prev) => (prev?.start === start && prev?.end === end ? prev : { start, end }));
    setMonth(arg.view.currentStart.toLocaleDateString(undefined, { month: "long" }));
    setViewType(arg.view.type);
  }, []);

  const onOpenTask = useCallback(
    (taskId: string) => router.replace(`${pathname}?task=${taskId}`, { scroll: false }),
    [router, pathname],
  );

  const withApi = (run: (api: ReturnType<FullCalendar["getApi"]>) => void) => {
    const api = calendarRef.current?.getApi();
    if (api) run(api);
  };

  const pickView = (type: string) => {
    setViewOpen(false);
    withApi((api) => api.changeView(type));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || dragging) return;
    if (document.querySelector(".fc-event-dragging, .fc-event-selected")) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dir = swipeDirection(start, { x: t.clientX, y: t.clientY, t: Date.now() });
    if (dir === "left") withApi((api) => api.next());
    if (dir === "right") withApi((api) => api.prev());
  };

  const pillPosition = { bottom: "calc(72px + env(safe-area-inset-bottom))" } as const;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-[52px] shrink-0 items-center pl-4 pr-1">
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold leading-7 tracking-[-0.02em] text-foreground">
          {month}
        </h1>
        <button
          type="button"
          onClick={() => withApi((api) => api.today())}
          className="ml-2 h-8 rounded-lg border border-border px-3 text-[13px] font-medium text-foreground"
        >
          Today
        </button>
        <HeaderIconButton label="Calendar view" onClick={() => setViewOpen(true)}>
          <IconDots className="size-6 text-foreground" />
        </HeaderIconButton>
      </header>

      <div
        className="sava-calendar sava-calendar-phone min-h-0 flex-1"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <CalendarGrid
          mobile
          spaceId={spaceId}
          range={range}
          calendarRef={calendarRef}
          onDatesSet={onDatesSet}
          onOpenTask={onOpenTask}
          onBlockTap={setBlock}
        />
      </div>

      {dragging ? (
        <div
          aria-hidden
          className="pointer-events-none whitespace-nowrap fixed left-1/2 z-30 flex h-12 -translate-x-1/2 items-center rounded-full bg-foreground px-5 text-[13px] font-medium text-background shadow-lg"
          style={pillPosition}
        >
          Drop on the calendar to schedule
        </div>
      ) : (
        !tasksOpen && (
          <button
            type="button"
            onClick={() => setTasksOpen(true)}
            className="fixed left-1/2 z-30 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-foreground pl-3.5 pr-[18px] text-[15px] font-semibold text-background shadow-lg"
            style={pillPosition}
          >
            <IconCircleCheck className="size-5" />
            See tasks
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-background/20 px-1.5 text-xs">
              {tasks?.length ?? 0}
            </span>
          </button>
        )
      )}

      <CalendarTasksPanel
        spaceId={spaceId}
        open={tasksOpen}
        hidden={dragging}
        onClose={() => setTasksOpen(false)}
        onOpenTask={onOpenTask}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => {
          setDragging(false);
          setTasksOpen(false);
        }}
      />
      <CalendarBlockSheet spaceId={spaceId} block={block} onClose={() => setBlock(null)} onOpenTask={onOpenTask} />

      <BottomSheet open={viewOpen} onOpenChange={setViewOpen} title="View">
        <BottomSheetOption selected={viewType === "timeGridDay"} onClick={() => pickView("timeGridDay")}>
          Day
        </BottomSheetOption>
        <BottomSheetOption selected={viewType === THREE_DAY_VIEW} onClick={() => pickView(THREE_DAY_VIEW)}>
          3 days
        </BottomSheetOption>
        <BottomSheetOption selected={viewType === "timeGridWeek"} onClick={() => pickView("timeGridWeek")}>
          Week
        </BottomSheetOption>
      </BottomSheet>
    </div>
  );
}