"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { IconChevronDown } from "@tabler/icons-react";
import { formatDue } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCalendarTasks } from "@/hooks/use-calendar";
import type { MyTaskDTO } from "@/server/services/types";

/**
 * The calendar's left rail (10.1): my open tasks with no future block of mine, filterable by
 * project on the client. Rows are dragged into the grid with FullCalendar's Draggable; the
 * drop itself is handled by the calendar's `drop` callback via the rows' data attributes.
 */
export function TaskRail({ spaceId }: { spaceId: string }) {
  const { data: tasks } = useCalendarTasks(spaceId, null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // One Draggable over the whole rail: any [data-task-id] row starts a 60-minute drag.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: "[data-task-id]",
      eventData: (eventEl) => ({
        title: eventEl.dataset.title ?? "",
        duration: "01:00",
        create: false,
      }),
    });
    return () => draggable.destroy();
  }, []);

  const list = useMemo(() => tasks ?? [], [tasks]);
  const shown = useMemo(
    () => (projectId === null ? list : list.filter((t) => t.projectId === projectId)),
    [list, projectId],
  );
  const projects = useMemo(() => {
    const map = new Map<string, Pick<MyTaskDTO, "projectId" | "projectName" | "projectColor">>();
    for (const t of list) {
      if (!map.has(t.projectId)) {
        map.set(t.projectId, { projectId: t.projectId, projectName: t.projectName, projectColor: t.projectColor });
      }
    }
    return [...map.values()];
  }, [list]);

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex shrink-0 items-center justify-between px-3 pb-1.5 pt-3">
        <h2 className="text-[13px] font-semibold leading-4 text-foreground/75">Unscheduled</h2>
        <ProjectFilter projects={projects} value={projectId} onChange={setProjectId} />
      </div>
      <div ref={railRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {shown.length === 0 ? (
          <p className="px-1 pt-1 text-[13px] text-muted-foreground">
            Everything assigned to you is scheduled.
          </p>
        ) : (
          <div className="flex flex-col">
            {shown.map((task) => (
              <RailRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function RailRow({ task }: { task: MyTaskDTO }) {
  const due = task.dueDate ? formatDue(task.dueDate, task.dueHasTime) : null;
  return (
    <div
      data-task-id={task.id}
      data-title={task.title}
      data-color={task.projectColor}
      className="cursor-grab rounded-md px-2 py-2 hover:bg-sidebar-accent active:cursor-grabbing"
    >
      <div className="truncate text-[13px] leading-5 text-foreground">{task.title}</div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: task.projectColor }} />
        <span className="truncate">
          {task.projectName} / {task.listName}
        </span>
        {due && (
          <span
            className={cn(
              "ml-auto shrink-0",
              due.tone === "overdue" ? "text-overdue" : due.tone === "today" ? "text-success font-medium" : "",
            )}
          >
            {due.label}
          </span>
        )}
      </div>
    </div>
  );
}

function ProjectFilter({
  projects,
  value,
  onChange,
}: {
  projects: { projectId: string; projectName: string; projectColor: string }[];
  value: string | null;
  onChange: (projectId: string | null) => void;
}) {
  const current = projects.find((p) => p.projectId === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-sidebar-accent"
          />
        }
      >
        {current ? (
          <>
            <span className="size-2 rounded-[2px]" style={{ backgroundColor: current.projectColor }} />
            {current.projectName}
          </>
        ) : (
          "All projects"
        )}
        <IconChevronDown className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup
          value={value ?? "all"}
          onValueChange={(v) => onChange(v === "all" ? null : v)}
        >
          <DropdownMenuRadioItem value="all" closeOnClick>
            All projects
          </DropdownMenuRadioItem>
          {projects.map((p) => (
            <DropdownMenuRadioItem key={p.projectId} value={p.projectId} closeOnClick>
              <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: p.projectColor }} />
              {p.projectName}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
