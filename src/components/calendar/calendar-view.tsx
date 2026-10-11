"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { DatesSetArg } from "@fullcalendar/core";
import type FullCalendar from "@fullcalendar/react";
import Link from "next/link";
import { IconBrandGoogle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useGoogleConnection, type Range } from "@/hooks/use-calendar";
import { useIsMobile } from "@/hooks/use-media-query";
import { MobileCalendarView } from "@/components/mobile/calendar-view";
import { CalendarGrid } from "./calendar-grid";
import { CalendarToolbar } from "./calendar-toolbar";
import { TaskRail } from "./task-rail";

export type CalendarViewProps = {
  spaceId: string;
};

/**
 * Section 10.1 calendar (local half): the list view's header band with the calendar toolbar, the
 * unscheduled rail and the FullCalendar grid, filling the viewport. FullCalendar is driven through
 * its API (getApi().today()/prev()/next()/changeView()) with headerToolbar off.
 */
export function CalendarView({ spaceId }: CalendarViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [title, setTitle] = useState("");
  const [view, setView] = useState("timeGridWeek");
  const google = useGoogleConnection().data;
  const isMobile = useIsMobile();

  const onDatesSet = useCallback((arg: DatesSetArg) => {
    const start = arg.start.toISOString();
    const end = arg.end.toISOString();
    setRange((prev) => (prev?.start === start && prev?.end === end ? prev : { start, end }));
    setTitle(arg.view.title);
    setView(arg.view.type);
  }, []);

  const onOpenTask = useCallback(
    (taskId: string) => router.replace(`${pathname}?task=${taskId}`, { scroll: false }),
    [router, pathname],
  );

  // On a phone the tab bar renders the mobile screen; the desktop layout stops here.
  if (isMobile) return <MobileCalendarView spaceId={spaceId} />;

  const withApi = (run: (api: ReturnType<FullCalendar["getApi"]>) => void) => {
    const api = calendarRef.current?.getApi();
    if (api) run(api);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="w-full shrink-0 border-b border-border bg-sidebar/50 px-4 pb-3 pt-5 md:px-6">
        <div className="flex h-11 items-center">
          <h1 className="grow text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-foreground">
            Calendar
          </h1>
          {google?.configured && !google.connected && (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/s/${spaceId}/integrations`} />}>
              <IconBrandGoogle aria-hidden />
              Connect Google Calendar
            </Button>
          )}
        </div>
        <CalendarToolbar
          title={title}
          view={view}
          onToday={() => withApi((api) => api.today())}
          onPrev={() => withApi((api) => api.prev())}
          onNext={() => withApi((api) => api.next())}
          onView={(next) => withApi((api) => api.changeView(next))}
        />
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="max-md:hidden">
          <TaskRail spaceId={spaceId} />
        </div>
        <div className="sava-calendar min-w-0 flex-1">
          <CalendarGrid
            spaceId={spaceId}
            range={range}
            calendarRef={calendarRef}
            onDatesSet={onDatesSet}
            onOpenTask={onOpenTask}
          />
        </div>
      </div>
    </div>
  );
}
