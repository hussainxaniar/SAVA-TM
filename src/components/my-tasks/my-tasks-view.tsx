"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { PriorityFlag } from "@/components/tasks/priority-flag";
import { StatusControl } from "@/components/tasks/status-icon";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useMyTaskStatus, useMyTasks } from "@/hooks/use-my-tasks";
import { formatDue } from "@/lib/list-view";
import { groupMyTasks } from "@/lib/my-tasks";
import { publishTaskOrder } from "@/lib/task-nav";
import { cn } from "@/lib/utils";
import type { MyTaskDTO, MyTasksDTO, StatusDTO, TaskRowDTO } from "@/server/services/types";

export type MyTasksViewProps = {
  spaceId: string;
  initialData: MyTasksDTO;
};

/**
 * Section 9.5 My Tasks (docs/design/list-view-separate.jsx.txt): the list view's header band and
 * Separate-mode rows over the shared ['my-tasks', spaceId] cache, grouped by due date. Rows open
 * the task dialog (?task=); there's no inline add, no drag and no row menu here.
 */
export function MyTasksView({ spaceId, initialData }: MyTasksViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useMyTasks(spaceId, initialData);

  // Per-browser preference (6.7): which groups are collapsed, by group key.
  const [collapsedIds, setCollapsedIds] = useLocalStorage("sava.myTasks.collapsed", [] as string[]);
  const collapsed = useMemo(() => new Set(collapsedIds), [collapsedIds]);

  const setStatus = useMyTaskStatus(spaceId);

  const groups = useMemo(() => groupMyTasks(data.tasks), [data.tasks]);
  const visible = useMemo(() => groups.filter((g) => g.tasks.length > 0), [groups]);

  const onSetStatus = useCallback(
    (task: TaskRowDTO, to: StatusDTO, completeSubtasks?: boolean) =>
      setStatus.mutate({ taskId: task.id, title: task.title, from: task.status, to, completeSubtasks }),
    [setStatus],
  );

  const openTask = useCallback(
    (taskId: string) => router.replace(`${pathname}?task=${taskId}`, { scroll: false }),
    [router, pathname],
  );

  const toggleCollapsed = useCallback(
    (key: string) =>
      setCollapsedIds(
        collapsedIds.includes(key) ? collapsedIds.filter((id) => id !== key) : [...collapsedIds, key],
      ),
    [collapsedIds, setCollapsedIds],
  );

  // The rows on screen, in order (T-11): the task dialog's ↑/↓ steps through them.
  const rowOrder = useMemo(() => {
    const ids: string[] = [];
    for (const group of visible) {
      if (collapsed.has(group.key)) continue;
      for (const task of group.tasks) ids.push(task.id);
    }
    return ids;
  }, [visible, collapsed]);
  useEffect(() => {
    publishTaskOrder(rowOrder);
  }, [rowOrder]);
  useEffect(() => () => publishTaskOrder([]), []);

  const n = data.tasks.length;

  return (
    <div>
      <header className="w-full border-b border-border bg-sidebar/50 pb-4">
        <div className="mx-auto w-full max-w-[880px] px-6 pt-5">
          <div className="flex h-11 items-center">
            <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-foreground">
              My Tasks
            </h1>
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {n} open task{n === 1 ? "" : "s"}
          </p>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[880px] px-6 pt-1 pb-24">
        {n === 0 ? (
          <div className="mt-7 text-center">
            <p className="text-sm font-medium text-foreground">Nothing assigned to you right now.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Tasks assigned to you in any project show up here.
            </p>
          </div>
        ) : (
          visible.map((group, i) => (
            <section key={group.key} className={i === 0 ? "mt-7" : "mt-6"}>
              <button
                type="button"
                onClick={() => toggleCollapsed(group.key)}
                aria-expanded={!collapsed.has(group.key)}
                className="flex h-8 w-full items-center border-b border-border"
              >
                <span className="flex w-5 shrink-0 justify-center text-muted-foreground">
                  {collapsed.has(group.key) ? (
                    <IconChevronRight className="size-3" strokeWidth={3} />
                  ) : (
                    <IconChevronDown className="size-3" strokeWidth={3} />
                  )}
                </span>
                <span className="flex h-6 shrink-0 items-center gap-2 rounded-md bg-pill pl-2 pr-2.5">
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-[0.04em]",
                      group.key === "overdue" ? "text-overdue" : "text-foreground/80",
                    )}
                  >
                    {group.label}
                  </span>
                </span>
                <span className="ml-2 text-[13px] text-muted-foreground">{group.tasks.length}</span>
              </button>
              {!collapsed.has(group.key) &&
                group.tasks.map((task) => (
                  <MyTaskRow
                    key={task.id}
                    task={task}
                    statuses={data.statusesByProject[task.projectId]}
                    onOpenTask={openTask}
                    onSetStatus={onSetStatus}
                  />
                ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

/** One row, styled like the list view's Separate rows: status control, two lines, due + flag. */
function MyTaskRow({
  task,
  statuses,
  onOpenTask,
  onSetStatus,
}: {
  task: MyTaskDTO;
  statuses: StatusDTO[];
  onOpenTask: (taskId: string) => void;
  /** `to` is resolved from this row's project statuses before the parent mutates. */
  onSetStatus: (task: TaskRowDTO, to: StatusDTO, completeSubtasks?: boolean) => void;
}) {
  const due = task.dueDate ? formatDue(task.dueDate, task.dueHasTime) : null;
  const flag = task.priority < 4 ? <PriorityFlag priority={task.priority} /> : null;

  return (
    <div
      onClick={() => onOpenTask(task.id)}
      className="relative flex items-start border-b border-divider py-2.5 hover:-mx-2 hover:rounded-md hover:bg-sidebar hover:px-2"
    >
      <div className="w-5 shrink-0" />
      <div className="mt-px ml-0.5 mr-3 shrink-0">
        {/* Keep clicks (open), context menu and keys from reaching the row. */}
        <span
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <StatusControl
            task={task}
            statuses={statuses}
            onSetStatus={(t, statusId, completeSubtasks) =>
              onSetStatus(t, statuses.find((s) => s.id === statusId)!, completeSubtasks)
            }
          />
        </span>
      </div>
      <div className="flex min-w-0 grow flex-col gap-[3px]">
        <span className={cn("truncate text-sm leading-5 text-foreground", task.subtaskCount > 0 && "font-medium")}>
          {task.title}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: task.projectColor }}
          />
          <span className="truncate">
            {task.projectName} / {task.listName}
            {task.parentTitle ? ` · ↳ ${task.parentTitle}` : ""}
          </span>
        </span>
      </div>
      {(due || flag) && (
        <div className="mt-0.5 ml-3 flex shrink-0 items-center gap-3">
          {due && (
            <span
              className={cn(
                "text-xs",
                due.tone === "overdue"
                  ? "text-overdue"
                  : due.tone === "today"
                    ? "text-success font-medium"
                    : "text-muted-foreground",
              )}
            >
              {due.label}
            </span>
          )}
          <div className="flex w-8 shrink-0 justify-center">{flag}</div>
        </div>
      )}
    </div>
  );
}