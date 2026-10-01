"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { comparePositions, positionBetween } from "@/lib/position";
import {
  addTaskToListAction,
  createTaskAction,
  deleteTaskAction,
  getTaskAction,
  moveTaskAction,
  removeTaskFromListAction,
  reorderTaskAction,
  restoreTaskAction,
  setAssigneesAction,
  setParentAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import type { ListViewDTO, TaskDetailDTO, TaskRowDTO, UserLite } from "@/server/services/types";
import {
  ActionError,
  descendants,
  listViewKey,
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
/** My Tasks (use-my-tasks.ts): refreshed after every task change so its groups stay right. */
const MY_TASKS: QueryKey = ["my-tasks"];

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
  priority?: 1 | 2 | 3 | 4;
  /** Date-only ISO (dateOnlyFromLocal) or null to clear. */
  startDate?: string | null;
  /** Date-only ISO, or an instant with dueHasTime: true; null clears both. */
  dueDate?: string | null;
  dueHasTime?: boolean;
};

/** Field edits from the task dialog: title, description, status, priority, start and due dates. */
export function useEditTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: TaskEdit) => unwrap(await updateTaskAction(v)),
    onMutate: async (v) => {
      const key = taskKey(v.taskId);
      // Everything but the description shows in rows (lists, the parent's subtask list).
      const touchesLists = Object.keys(v).some((k) => k !== "taskId" && k !== "description");
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
          : patchTaskFields(data, rowFields(v));
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
      if (Object.keys(v).some((k) => k !== "taskId" && k !== "description")) {
        void qc.invalidateQueries({ queryKey: ALL_TASKS }); // this task, its feed, any parent showing it
        void qc.invalidateQueries({ queryKey: ALL_LISTS });
      void qc.invalidateQueries({ queryKey: MY_TASKS });
      } else {
        // A description save adds an activity line ("updated the description").
        void qc.invalidateQueries({ queryKey: [...taskKey(v.taskId), "feed"] });
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
      void qc.invalidateQueries({ queryKey: MY_TASKS });
          },
        },
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ALL_LISTS });
      void qc.invalidateQueries({ queryKey: MY_TASKS });
    },
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
          linkedListIds: [],
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
      void qc.invalidateQueries({ queryKey: MY_TASKS });
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
      void qc.invalidateQueries({ queryKey: MY_TASKS });
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
        qc.invalidateQueries({ queryKey: MY_TASKS }),
      ]);
    },
  });
}

/**
 * The Assignees picker (6.8): replaces the task's assignees with `assignees` (current members
 * only; the server re-checks). Optimistic in the dialog, every list row and the parent's
 * subtask list; the server logs ASSIGNEE_ADDED / ASSIGNEE_REMOVED for the difference.
 */
export function useSetAssignees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { taskId: string; assignees: UserLite[] }) =>
      unwrap(await setAssigneesAction({ taskId: v.taskId, userIds: v.assignees.map((u) => u.id) })),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ALL_TASKS });
      await qc.cancelQueries({ queryKey: ALL_LISTS });
      const touched: [QueryKey, unknown][] = [];
      const set = <T>(key: QueryKey, data: T) => {
        touched.push([key, qc.getQueryData(key)]);
        qc.setQueryData(key, data);
      };
      const detail = qc.getQueryData<TaskDetailDTO>(taskKey(v.taskId));
      if (detail) set(taskKey(v.taskId), { ...detail, assignees: v.assignees });
      for (const [key, parent] of parentsShowing(qc, v.taskId)) {
        set(key, { ...parent, subtasks: parent.subtasks.map((t) => (t.id === v.taskId ? { ...t, assignees: v.assignees } : t)) });
      }
      for (const [key, data] of qc.getQueriesData<ListViewDTO>({ queryKey: ALL_LISTS })) {
        if (!data?.tasks.some((t) => t.id === v.taskId)) continue;
        set(key, { ...data, tasks: data.tasks.map((t) => (t.id === v.taskId ? { ...t, assignees: v.assignees } : t)) });
      }
      return { touched };
    },
    onError: (error, _v, context) => {
      for (const [key, data] of context?.touched ?? []) qc.setQueryData(key, data);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ALL_TASKS });
      void qc.invalidateQueries({ queryKey: ALL_LISTS });
      void qc.invalidateQueries({ queryKey: MY_TASKS });
    },
  });
}

// ---------- Move / link (6.5, 6.6) ----------

/**
 * "Move to…" and a plain sidebar drop: a top-level task and its subtree change home list. The
 * rows leave the old home list's view at once; everything re-syncs on settle and the sidebar
 * counts refresh. Subtasks are refused by the server (the UI hides the option for them).
 */
export function useMoveTask() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (v: { taskId: string; fromListId: string; toListId: string; beforeId?: string | null; afterId?: string | null }) =>
      unwrap(
        await moveTaskAction({ taskId: v.taskId, toListId: v.toListId, beforeId: v.beforeId ?? null, afterId: v.afterId ?? null }),
      ),
    onMutate: async (v) => {
      const key = listViewKey(v.fromListId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ListViewDTO>(key);
      if (prev) qc.setQueryData(key, withoutSubtree(prev, v.taskId));
      return { prev };
    },
    onError: (error, v, context) => {
      if (context?.prev) qc.setQueryData(listViewKey(v.fromListId), context.prev);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSuccess: () => router.refresh(),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ALL_LISTS });
      void qc.invalidateQueries({ queryKey: MY_TASKS });
      void qc.invalidateQueries({ queryKey: ALL_TASKS });
    },
  });
}

/** "Add to list…" and an Alt sidebar drop: a link, home unchanged (any depth). */
export function useAddToList() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (v: { taskId: string; listId: string }) => unwrap(await addTaskToListAction(v)),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong. Try again."),
    onSuccess: () => router.refresh(),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ALL_LISTS });
      void qc.invalidateQueries({ queryKey: MY_TASKS });
      void qc.invalidateQueries({ queryKey: ALL_TASKS });
    },
  });
}

/**
 * "Remove from this list" (a linked row) and the dialog's list chip ×: deletes only the link.
 * The linked row (and the subtree shown under it) leaves that list's view at once.
 */
export function useRemoveFromList() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (v: { taskId: string; listId: string }) => unwrap(await removeTaskFromListAction(v)),
    onMutate: async (v) => {
      const key = listViewKey(v.listId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ListViewDTO>(key);
      if (prev) qc.setQueryData(key, withoutSubtree(prev, v.taskId));
      const detailKey = taskKey(v.taskId);
      const prevDetail = qc.getQueryData<TaskDetailDTO>(detailKey);
      if (prevDetail) {
        qc.setQueryData<TaskDetailDTO>(detailKey, {
          ...prevDetail,
          linkedListIds: prevDetail.linkedListIds.filter((id) => id !== v.listId),
          linkedLists: prevDetail.linkedLists.filter((l) => l.id !== v.listId),
        });
      }
      return { prev, prevDetail };
    },
    onError: (error, v, context) => {
      if (context?.prev) qc.setQueryData(listViewKey(v.listId), context.prev);
      if (context?.prevDetail) qc.setQueryData(taskKey(v.taskId), context.prevDetail);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSuccess: () => router.refresh(),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ALL_LISTS });
      void qc.invalidateQueries({ queryKey: MY_TASKS });
      void qc.invalidateQueries({ queryKey: ALL_TASKS });
    },
  });
}

/** A list view without `taskId` and the descendants shown under it. */
function withoutSubtree(data: ListViewDTO, taskId: string): ListViewDTO {
  const gone = new Set([taskId, ...descendants(data.tasks, taskId)]);
  return recount({ ...data, tasks: data.tasks.filter((t) => !gone.has(t.id)) });
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
    const next = patchRowFields(t, v);
    if (v.title !== undefined) next.title = v.title.trim();
    if (status) {
      next.status = status;
      next.completedAt = status.category === "DONE" ? (t.completedAt ?? now) : null;
    }
    return next;
  });
  return { ...parent, subtasks, openSubtaskCount: subtasks.filter((t) => !t.completedAt).length };
}

/** The row-visible part of an edit (what patchTaskFields understands). */
function rowFields(v: TaskEdit) {
  return {
    taskId: v.taskId,
    title: v.title,
    priority: v.priority,
    startDate: v.startDate,
    dueDate: v.dueDate,
    dueHasTime: v.dueHasTime,
  };
}

/** Priority and dates on any row-shaped object. */
function patchRowFields<T extends TaskRowDTO>(t: T, v: TaskEdit): T {
  const next = { ...t };
  if (v.priority !== undefined) next.priority = v.priority;
  if (v.startDate !== undefined) next.startDate = v.startDate;
  if (v.dueDate !== undefined) {
    next.dueDate = v.dueDate;
    next.dueHasTime = v.dueDate ? (v.dueHasTime ?? false) : false;
  } else if (v.dueHasTime !== undefined && t.dueDate) {
    next.dueHasTime = v.dueHasTime;
  }
  return next;
}

function patchDetail(task: TaskDetailDTO, v: TaskEdit): TaskDetailDTO {
  const next: TaskDetailDTO = patchRowFields(task, v);
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
