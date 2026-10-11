"use client";

import { useCallback, useMemo } from "react";
import { IconCircleCheck } from "@tabler/icons-react";
import { AddTaskFab } from "@/components/mobile/fab";
import { ScreenHeader } from "@/components/mobile/screen-header";
import { MobileTaskRow } from "@/components/mobile/task-row";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { groupMyTasks } from "@/lib/my-tasks";
import { requestQuickAdd } from "@/lib/quick-add";
import type { MyTaskDTO, MyTasksDTO, StatusDTO, TaskRowDTO } from "@/server/services/types";

/**
 * My tasks on a phone (docs/design/mobile.md "My tasks"): date groups of two-line rows over the
 * same data the desktop view uses. Next 7 days and Later are one "Upcoming" group; groups don't
 * collapse here.
 */
export function MobileMyTasks({
  spaceId,
  data,
  onOpenTask,
  onSetStatus,
}: {
  spaceId: string;
  data: MyTasksDTO;
  onOpenTask: (taskId: string) => void;
  onSetStatus: (task: TaskRowDTO, to: StatusDTO, completeSubtasks?: boolean) => void;
}) {
  // next7 + later share one header ("Upcoming"); their rows keep groupMyTasks' order.
  const groups = useMemo(() => {
    const merged: { key: string; label: string; tasks: MyTaskDTO[] }[] = [];
    for (const group of groupMyTasks(data.tasks)) {
      if (group.key === "next7" || group.key === "later") {
        const last = merged[merged.length - 1];
        if (last && last.key === "upcoming") last.tasks.push(...group.tasks);
        else merged.push({ key: "upcoming", label: "Upcoming", tasks: [...group.tasks] });
      } else {
        merged.push({ key: group.key, label: group.label, tasks: group.tasks });
      }
    }
    return merged.filter((group) => group.tasks.length > 0);
  }, [data.tasks]);

  // The row reports a status id; resolve it against that row's project statuses.
  const handleSetStatus = useCallback(
    (task: TaskRowDTO, statusId: string, completeSubtasks?: boolean) => {
      // Status ids are unique across projects, so the row's own project needn't be looked up.
      const to = Object.values(data.statusesByProject).flat().find((s) => s.id === statusId);
      if (to) onSetStatus(task, to, completeSubtasks);
    },
    [data.statusesByProject, onSetStatus],
  );

  const n = data.tasks.length;

  return (
    <div>
      <ScreenHeader
        title="My tasks"
        subtitle={`${n} task${n === 1 ? "" : "s"}`}
        actions={<NotificationBell spaceId={spaceId} />}
      />
      {n === 0 ? (
        <div className="flex flex-col items-center gap-3 px-10 pt-24 text-center">
          <div className="flex size-[88px] items-center justify-center rounded-full bg-selected">
            <IconCircleCheck className="size-11 text-primary" stroke={1.6} />
          </div>
          <h2 className="pt-3 text-xl font-semibold text-foreground">Nothing on your plate</h2>
          <p className="text-[15px] leading-[22px] text-muted-foreground">
            Tasks assigned to you show up here, grouped by due date.
          </p>
          <button
            type="button"
            onClick={requestQuickAdd}
            className="h-12 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
          >
            Add task
          </button>
        </div>
      ) : (
        <div className="pb-24">
          {groups.map((group, i) => (
            <section key={group.key} className={i === 0 ? undefined : "mt-5"}>
              <div className="flex h-11 items-center gap-2 border-b border-border px-4">
                <span className="text-[15px] font-semibold leading-5 text-foreground">{group.label}</span>
                <span className="text-[13px] text-muted-foreground">{group.tasks.length}</span>
              </div>
              {group.tasks.map((task) => (
                <MobileTaskRow
                  key={task.id}
                  task={task}
                  statuses={data.statusesByProject[task.projectId] ?? []}
                  context={{
                    projectName: task.projectName,
                    listName: task.listName,
                    projectColor: task.projectColor,
                  }}
                  onOpenTask={onOpenTask}
                  onSetStatus={handleSetStatus}
                />
              ))}
            </section>
          ))}
        </div>
      )}
      {n > 0 && <AddTaskFab />}
    </div>
  );
}