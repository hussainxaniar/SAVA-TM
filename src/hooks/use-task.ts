"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { comparePositions, positionBetween } from "@/lib/position";
import {
  createTaskAction,
  deleteTaskAction,
  getTaskAction,
  reorderTaskAction,
  restoreTaskAction,
  setParentAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import type { ListViewDTO, TaskDetailDTO, TaskRowDTO } from "@/server/services/types";
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
const ALL_TASKS: QueryKey = ["task"];

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
      // The parent's dialog lists this task among its subtasks: keep that row in step too.
      const prevParents = touchesLists ? parentsShowing(qc, v.taskId) : [];
      for (const [parentKey, parent] of prevParents) qc.setQueryData(parentKey, patchSubtaskRow(parent, v));
      for (const [listKey, data] of prevLists) {
        if (!data?.tasks.some((t) => t.id === v.taskId)) continue;
        const next = v.statusId
          ? patchStatus(data, { taskId: v.taskId, statusId: v.statusId, completeSubtasks: v.completeSubtasks })
          : patchTaskFields(data, { taskId: v.taskId, title: v.title });
        qc.setQueryData(listKey, recount(next));
      }
      return { prevTask, prevLists, prevParents };
    },
    onError: (error, v, context) => {
      if (context?.prevTask) qc.setQueryData(taskKey(v.taskId), context.prevTask);
      for (const [listKey, data] of context?.prevLists ?? []) qc.setQueryData(listKey, data);
      for (const [parentKey, data] of context?.prevParents ?? []) qc.setQueryData(parentKey, data);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: (_r, _e, v) => {
      // Description-only saves don't refetch the task: the editor is the source of truth while
      // it's open, and a refetch mid-typing would be wasted.
      if (v.title !== undefined || v.statusId !== undefined) {
        void qc.invalidateQueries({ queryKey: ALL_TASKS }); // this task and any parent showing it
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

/**
 * The dialog's "+ Add subtask" (T-12): a temporary row (id "temp-…") appears in the parent's
 * subtask list at once and is swapped for the server's row; list views re-sync on settle.
 * Depth past three levels is refused by the server (6.4.1) and rolls back with its message.
 */
export function useAddSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { parentId: string; listId: string; title: string; tempId: string }) =>
      unwrap(await createTaskAction({ listId: v.listId, parentId: v.parentId, title: v.title })),
    onMutate: async (v) => {
      const key = taskKey(v.parentId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskDetailDTO>(key);
      if (prev) {
        const status = prev.statuses.find((x) => x.category === "TODO") ?? prev.status;
        const last = prev.subtasks.at(-1)?.position ?? null;
        const temp: TaskRowDTO = {
          id: v.tempId,
          title: v.title.trim(),
          priority: 4,
          status,
          completedAt: null,
          startDate: null,
          dueDate: null,
          dueHasTime: false,
          assignees: [],
          parentId: prev.id,
          parentTitle: prev.title,
          depth: prev.depth + 1,
          homeListId: prev.homeList.id,
          isLinkedHere: false,
          subtaskCount: 0,
          openSubtaskCount: 0,
          commentCount: 0,
          position: positionBetween(last, null),
        };
        qc.setQueryData<TaskDetailDTO>(key, {
          ...prev,
          subtasks: [...prev.subtasks, temp],
          subtaskCount: prev.subtaskCount + 1,
          openSubtaskCount: prev.openSubtaskCount + 1,
        });
      }
      return { prev };
    },
    onError: (error, v, context) => {
      if (context?.prev) qc.setQueryData(taskKey(v.parentId), context.prev);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSuccess: (row, v) => {
      qc.setQueryData<TaskDetailDTO>(taskKey(v.parentId), (d) =>
        d ? { ...d, subtasks: d.subtasks.map((t) => (t.id === v.tempId ? row : t)) } : d,
      );
    },
    onSettled: (_r, _e, v) => {
      void qc.invalidateQueries({ queryKey: taskKey(v.parentId) });
      void qc.invalidateQueries({ queryKey: ALL_LISTS });
    },
  });
}

/**
 * Drag to reorder in the dialog's subtask list. beforeId = the subtask now directly above,
 * afterId = directly below (same convention as the list view). listId = the parent's home list.
 */
export function useReorderSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { parentId: string; taskId: string; listId: string; beforeId: string | null; afterId: string | null }) =>
      unwrap(await reorderTaskAction({ taskId: v.taskId, listId: v.listId, beforeId: v.beforeId, afterId: v.afterId })),
    onMutate: async (v) => {
      const key = taskKey(v.parentId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskDetailDTO>(key);
      if (prev) {
        const pos = (id: string | null) => (id ? prev.subtasks.find((t) => t.id === id)?.position ?? null : null);
        try {
          const position = positionBetween(pos(v.beforeId), pos(v.afterId));
          const subtasks = prev.subtasks
            .map((t) => (t.id === v.taskId ? { ...t, position } : t))
            .sort((a, b) => comparePositions(a.position, b.position));
          qc.setQueryData<TaskDetailDTO>(key, { ...prev, subtasks });
        } catch {
          // neighbours out of order locally; the server decides
        }
      }
      return { prev };
    },
    onError: (error, v, context) => {
      if (context?.prev) qc.setQueryData(taskKey(v.parentId), context.prev);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: (_r, _e, v) => {
      void qc.invalidateQueries({ queryKey: taskKey(v.parentId) });
      void qc.invalidateQueries({ queryKey: ALL_LISTS });
    },
  });
}

/**
 * "Make subtask of…" (parentId) / "Convert to task" (parentId: null), rules 6.4.3. Not
 * optimistic: the tree changes shape, so every list and open dialog re-syncs when it lands.
 * Returns a promise so the caller can toast on success; failures toast here.
 */
export function useSetParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { taskId: string; parentId: string | null }) => unwrap(await setParentAction(v)),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong. Try again."),
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ALL_LISTS }),
        qc.invalidateQueries({ queryKey: ALL_TASKS }),
      ]);
    },
  });
}

/** Cached task details (dialogs) whose subtask list includes `taskId`. */
function parentsShowing(qc: ReturnType<typeof useQueryClient>, taskId: string) {
  return qc
    .getQueriesData<TaskDetailDTO>({ queryKey: ALL_TASKS })
    .filter((entry): entry is [QueryKey, TaskDetailDTO] => !!entry[1]?.subtasks?.some((t) => t.id === taskId));
}

/** Applies a title/status edit to the matching row in a parent's subtask list. */
function patchSubtaskRow(parent: TaskDetailDTO, v: TaskEdit): TaskDetailDTO {
  const now = new Date().toISOString();
  const status = v.statusId ? parent.statuses.find((x) => x.id === v.statusId) : undefined;
  const subtasks = parent.subtasks.map((t) => {
    if (t.id !== v.taskId) return t;
    const next = { ...t };
    if (v.title !== undefined) next.title = v.title.trim();
    if (status) {
      next.status = status;
      next.completedAt = status.category === "DONE" ? (t.completedAt ?? now) : null;
    }
    return next;
  });
  return { ...parent, subtasks, openSubtaskCount: subtasks.filter((t) => !t.completedAt).length };
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
