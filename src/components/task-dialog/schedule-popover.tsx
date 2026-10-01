"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { withLocalTime } from "@/lib/list-view";
import { useCreateTimeBlock } from "@/hooks/use-calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TaskDetailDTO } from "@/server/services/types";
import { DatePicker } from "./date-picker";

/**
 * The Scheduled section's `+` (9.4.6): pick a day, a start time and a duration, then schedule
 * a block with createTimeBlock. The day picker stays open on pick (closeOnPick={false}) so the
 * start and duration can be set next.
 */
export function SchedulePopover({ task }: { task: TaskDetailDTO }) {
  const createTimeBlock = useCreateTimeBlock(task.spaceId);
  const [day, setDay] = useState<Date | null>(new Date());
  const [start, setStart] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [open, setOpen] = useState(false);

  const schedule = async () => {
    if (!day) return;
    const startISO = withLocalTime(day, start);
    const endISO = new Date(new Date(startISO).getTime() + Number(duration) * 60_000).toISOString();
    try {
      await createTimeBlock.mutateAsync({
        taskId: task.id,
        taskTitle: task.title,
        projectColor: task.project.color,
        start: startISO,
        end: endISO,
        tempId: `temp-${crypto.randomUUID()}`,
      });
      setOpen(false);
    } catch {
      // the hook toasted the failure
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Schedule a block"
            className="-mr-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent"
          />
        }
      >
        <IconPlus className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[264px] p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Day</span>
            <DatePicker
              day={day}
              time={null}
              allowTime={false}
              closeOnPick={false}
              showClear={false}
              onChange={(d) => setDay(d)}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-14 shrink-0 text-sm text-muted-foreground">Start</span>
            <input
              type="time"
              aria-label="Start time"
              value={start}
              onChange={(e) => {
                if (e.target.value) setStart(e.target.value);
              }}
              className="h-8 min-w-0 flex-1 rounded-md border px-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-14 shrink-0 text-sm text-muted-foreground">Duration</span>
            <select
              aria-label="Duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="30">30 min</option>
              <option value="60">1 h</option>
              <option value="90">1 h 30</option>
              <option value="120">2 h</option>
              <option value="180">3 h</option>
            </select>
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!day || createTimeBlock.isPending}
            onClick={() => void schedule()}
          >
            Schedule
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
