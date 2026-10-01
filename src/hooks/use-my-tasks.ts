"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMyTasksAction, updateTaskAction } from "@/server/actions/tasks";
import type { MyTasksDTO, StatusDTO } from "@/server/services/types";
import { unwrap } from "./use-list-view";

/*
 * My Tasks (T-16, Section 9.5): the open tasks assigned to me in a space. Key ['my-tasks', spaceId];
 * every task-dialog mutation (use-task.ts) invalidates ['my-tasks'], so editing a task from this
 * page regroups or removes its row.
 */

export const myTasksKey = (spaceId: string) => ["my-tasks", spaceId] as const;

export function useMyTasks(spaceId: string, initialData: MyTasksDTO) {
  return useQuery({
    queryKey: myTasksKey(spaceId),
    queryFn: async () => unwrap(await getMyTasksAction({ spaceId })),
    initialData,
  });
}

/**
 * The row's status menu. Moving into a DONE status removes the row at once (My Tasks lists open
 * tasks only) and shows a 10-second "Completed" toast whose Undo puts the previous status back.
 * With `completeSubtasks`, open subtasks are completed too (6.2.4); Undo reopens only the task.
 */
export function useMyTaskStatus(spaceId: string) {
  const qc = useQueryClient();
  const key = myTasksKey(spaceId);
  return useMutation({
    mutationFn: async (v: { taskId: string; title: string; from: StatusDTO; to: StatusDTO; completeSubtasks?: boolean }) =>
      unwrap(await updateTaskAction({ taskId: v.taskId, statusId: v.to.id, completeSubtasks: v.completeSubtasks })),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MyTasksDTO>(key);
      if (prev) {
        const done = v.to.category === "DONE";
        qc.setQueryData<MyTasksDTO>(key, {
          ...prev,
          tasks: done
            ? prev.tasks.filter((t) => t.id !== v.taskId)
            : prev.tasks.map((t) => (t.id === v.taskId ? { ...t, status: v.to } : t)),
        });
      }
      return { prev };
    },
    onError: (error, _v, context) => {
      if (context?.prev) qc.setQueryData(key, context.prev);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSuccess: (_r, v) => {
      if (v.to.category !== "DONE" || v.from.category === "DONE") return;
      toast(`Completed "${v.title}"`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            const res = await updateTaskAction({ taskId: v.taskId, statusId: v.from.id });
            if (!res.ok) toast.error(res.error.message);
            void qc.invalidateQueries({ queryKey: key });
            void qc.invalidateQueries({ queryKey: ["tasks"] });
          },
        },
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["task"] });
    },
  });
}
