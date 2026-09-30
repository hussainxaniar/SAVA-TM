"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteTaskAction, getTaskAction, restoreTaskAction, updateTaskAction } from "@/server/actions/tasks";
import type { ListViewDTO, TaskDetailDTO } from "@/server/services/types";
import {
  ActionError,
  descendants,
  patchStatus,
  patchTaskFields,
  recount,
  taskKey,
  unwrap,
} from "./use-list-view";

/*
 * TanStack Query for the task dialog (Section 9.4). The dialog reads ['task', taskId]. Edits are
 * optimistic in the task AND in every cached list view (['tasks', listId]) that shows the task,
 * so the row behind the dialog changes at the same moment; on failure everything rolls back
 * with an error toast.
 */

const ALL_LISTS: QueryKey = ["tasks"];

/** The open task. Not-found (deleted, or no access) is not retried: the dialog shows it. */
export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: taskKey(taskId ?? ""),
    queryFn: async () => unwrap(await getTaskAction({ taskId: taskId! })),
    enabled: !!taskId,
    retry: (count, error) => !(error instanceof ActionError && error.code === "NOT_FOUND") && count < 2,
  });
}

export type TaskEdit = {
  taskId: string;
  title?: string;
  /** Tiptap JSON; null clears it. */
  description?: { type: "doc"; [key: string]: unknown } | null;
  statusId?: string;
  /** With a DONE statusId: also complete open descendants (6.2.4). */
  completeSubtasks?: boolean;
};

/** Title, description and status edits from the task dialog. */
export function useEditTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: TaskEdit) => unwrap(await updateTaskAction(v)),
    onMutate: async (v) => {
      const key = taskKey(v.taskId);
      const touchesLists = v.title !== undefined || v.statusId !== undefined;
      await qc.cancelQueries({ queryKey: key });
      if (touchesLists) await qc.cancelQueries({ queryKey: ALL_LISTS });

      const prevTask = qc.getQueryData<TaskDetailDTO>(key);
      const prevLists = touchesLists ? qc.getQueriesData<ListViewDTO>({ queryKey: ALL_LISTS }) : [];
      if (prevTask) qc.setQueryData<TaskDetailDTO>(key, patchDetail(prevTask, v));
      for (const [listKey, data] of prevLists) {
        if (!data?.tasks.some((t) => t.id === v.taskId)) continue;
        const next = v.statusId
          ? patchStatus(data, { taskId: v.taskId, statusId: v.statusId, completeSubtasks: v.completeSubtasks })
          : patchTaskFields(data, { taskId: v.taskId, title: v.title });
        qc.setQueryData(listKey, recount(next));
      }
      return { prevTask, prevLists };
    },
    onError: (error, v, context) => {
      if (context?.prevTask) qc.setQueryData(taskKey(v.taskId), context.prevTask);
      for (const [listKey, data] of context?.prevLists ?? []) qc.setQueryData(listKey, data);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: (_r, _e, v) => {
      // Description-only saves don't refetch the task: the editor is the source of truth while
      // it's open, and a refetch mid-typing would be wasted.
      if (v.title !== undefined || v.statusId !== undefined) {
        void qc.invalidateQueries({ queryKey: taskKey(v.taskId) });
        void qc.invalidateQueries({ queryKey: ALL_LISTS });
      }
    },
  });
}

/**
 * Delete from the dialog's ⋯ menu: soft delete, removed from every cached list at once, with the
 * 10-second Undo toast (6.4.5). The caller closes the dialog.
 */
export function useDeleteTaskAnywhere() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { taskId: string; title: string }) => unwrap(await deleteTaskAction({ taskId: v.taskId })),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ALL_LISTS });
      const prevLists = qc.getQueriesData<ListViewDTO>({ queryKey: ALL_LISTS });
      for (const [listKey, data] of prevLists) {
        if (!data?.tasks.some((t) => t.id === v.taskId)) continue;
        const gone = new Set([v.taskId, ...descendants(data.tasks, v.taskId)]);
        qc.setQueryData(listKey, recount({ ...data, tasks: data.tasks.filter((t) => !gone.has(t.id)) }));
      }
      return { prevLists };
    },
    onError: (error, _v, context) => {
      for (const [listKey, data] of context?.prevLists ?? []) qc.setQueryData(listKey, data);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSuccess: (_r, v) => {
      qc.removeQueries({ queryKey: taskKey(v.taskId) });
      toast(`Deleted "${v.title}"`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            const res = await restoreTaskAction({ taskId: v.taskId });
            if (!res.ok) toast.error(res.error.message);
            void qc.invalidateQueries({ queryKey: ALL_LISTS });
          },
        },
      });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ALL_LISTS }),
  });
}

function patchDetail(task: TaskDetailDTO, v: TaskEdit): TaskDetailDTO {
  const next: TaskDetailDTO = { ...task };
  if (v.title !== undefined) next.title = v.title.trim();
  if (v.description !== undefined) next.description = v.description;
  if (v.statusId !== undefined) {
    const status = task.statuses.find((s) => s.id === v.statusId);
    if (status) {
      const now = new Date().toISOString();
      const intoDone = status.category === "DONE" && task.status.category !== "DONE";
      next.status = status;
      next.completedAt = status.category === "DONE" ? (task.completedAt ?? now) : null;
      if (intoDone && v.completeSubtasks) {
        next.subtasks = task.subtasks.map((t) => (t.completedAt ? t : { ...t, status, completedAt: now }));
        next.openSubtaskCount = 0;
      }
    }
  }
  return next;
}
