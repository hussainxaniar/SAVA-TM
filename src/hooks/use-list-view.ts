"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { comparePositions, positionBetween } from "@/lib/position";
import type { ActionResult } from "@/server/actions/action";
import { updateListAction } from "@/server/actions/lists";
import {
  createTaskAction,
  deleteTaskAction,
  getListViewAction,
  reorderTaskAction,
  restoreTaskAction,
  setCompletedAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import type { CreateTaskInput, UpdateTaskInput } from "@/server/services/tasks";
import type { ListViewDTO, StatusDTO, TaskRowDTO } from "@/server/services/types";

/*
 * TanStack Query for the list view (Section 4): the page renders with server data
 * (`initialData`), then every mutation here patches the cache immediately (optimistic),
 * rolls back with an error toast if the server refuses, and re-syncs on settle.
 * Query keys: ['tasks', listId] for a list, ['task', taskId] for the task dialog (use-task.ts).
 */

export const listViewKey = (listId: string) => ["tasks", listId] as const;
export const taskKey = (taskId: string) => ["task", taskId] as const;

export class ActionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Unwraps an ActionResult, throwing ActionError on failure. */
export function unwrap<T>(res: ActionResult<T>): T {
  if (!res.ok) throw new ActionError(res.error.code, res.error.message);
  return res.data;
}

export function useListView(listId: string, initialData: ListViewDTO) {
  return useQuery({
    queryKey: listViewKey(listId),
    queryFn: async () => unwrap(await getListViewAction({ listId })),
    initialData,
  });
}

// ---------- mutations ----------

type Patch<V> = (data: ListViewDTO, vars: V) => ListViewDTO;

function useListMutation<V, R>(
  listId: string,
  opts: {
    run: (vars: V) => Promise<ActionResult<R>>;
    patch: Patch<V>;
    onSuccess?: (result: R, vars: V) => void;
  },
) {
  const qc = useQueryClient();
  const key = listViewKey(listId);
  return useMutation({
    mutationFn: async (vars: V) => unwrap(await opts.run(vars)),
    onMutate: async (vars: V) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ListViewDTO>(key);
      if (previous) qc.setQueryData<ListViewDTO>(key, recount(opts.patch(previous, vars)));
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSuccess: (result, vars) => opts.onSuccess?.(result, vars),
    onSettled: (_r, _e, vars) => {
      void qc.invalidateQueries({ queryKey: key });
      const taskId = (vars as { taskId?: string }).taskId;
      if (taskId) void qc.invalidateQueries({ queryKey: taskKey(taskId) });
    },
  });
}

/** Checkbox (6.2): complete into the first DONE status, or reopen into the first TODO status. */
export function useSetCompleted(listId: string) {
  return useListMutation(listId, {
    run: (v: { taskId: string; completed: boolean; includeSubtasks?: boolean }) => setCompletedAction(v),
    patch: (data, v) => {
      const target = firstStatus(data.statuses, v.completed ? "DONE" : "TODO");
      if (!target) return data;
      const ids = new Set([v.taskId, ...(v.completed && v.includeSubtasks ? descendants(data.tasks, v.taskId) : [])]);
      const now = new Date().toISOString();
      return mapTasks(data, (t) =>
        ids.has(t.id) && (v.completed ? !t.completedAt : !!t.completedAt)
          ? { ...t, status: target, completedAt: v.completed ? now : null }
          : t,
      );
    },
  });
}

/** Field edits from rows/menus (title, priority, status, dates). */
export function useUpdateTask(listId: string) {
  return useListMutation(listId, {
    run: (v: UpdateTaskInput) => updateTaskAction(v as Parameters<typeof updateTaskAction>[0]),
    patch: patchTaskFields,
  });
}

/**
 * The status menu (ClickUp-style): set any status of the project. Moving into a DONE status with
 * `completeSubtasks` also completes open descendants into that status (6.2.4).
 */
export function useSetStatus(listId: string) {
  return useListMutation(listId, {
    run: (v: StatusChange) => updateTaskAction(v),
    patch: patchStatus,
  });
}

/**
 * Inline add. The temporary row (id "temp-…") shows instantly and is swapped for the server's
 * row on success. Returns the created TaskRowDTO from mutateAsync.
 */
export function useCreateTask(listId: string) {
  const qc = useQueryClient();
  const key = listViewKey(listId);
  return useListMutation(listId, {
    run: (v: CreateTaskInput & { tempId: string }) => {
      const { tempId: _tempId, ...input } = v;
      void _tempId;
      return createTaskAction(input as Parameters<typeof createTaskAction>[0]);
    },
    patch: (data, v) => {
      const parent = v.parentId ? data.tasks.find((t) => t.id === v.parentId) : undefined;
      const status =
        (v.statusId && data.statuses.find((s) => s.id === v.statusId)) || firstStatus(data.statuses, "TODO");
      if (!status) return data;
      const after = v.afterTaskId ? data.tasks.find((t) => t.id === v.afterTaskId) : undefined;
      const temp: TaskRowDTO = {
        id: v.tempId,
        title: v.title.trim(),
        priority: (v.priority ?? 4) as TaskRowDTO["priority"],
        status,
        completedAt: status.category === "DONE" ? new Date().toISOString() : null,
        startDate: v.startDate ?? null,
        dueDate: v.dueDate ?? null,
        dueHasTime: v.dueDate ? (v.dueHasTime ?? false) : false,
        assignees: [],
        parentId: parent?.id ?? null,
        parentTitle: parent?.title ?? null,
        depth: parent ? parent.depth + 1 : 0,
        homeListId: parent?.homeListId ?? listId,
        isLinkedHere: false,
        subtaskCount: 0,
        openSubtaskCount: 0,
        commentCount: 0,
        // Client-only ordering until the server's row replaces it: right after `after`, else last.
        position: after ? `${after.position}0` : "￿",
      };
      return { ...data, tasks: [...data.tasks, temp] };
    },
    onSuccess: (row, v) => {
      qc.setQueryData<ListViewDTO>(key, (data) =>
        data ? recount({ ...data, tasks: data.tasks.map((t) => (t.id === v.tempId ? row : t)) }) : data,
      );
    },
  });
}

/** Manual-sort drag (6.7). beforeId = row now directly above, afterId = directly below. */
export function useReorderTask(listId: string) {
  return useListMutation(listId, {
    run: (v: { taskId: string; beforeId: string | null; afterId: string | null }) => reorderTaskAction({ ...v, listId }),
    patch: (data, v) => {
      const pos = (id: string | null) => (id ? data.tasks.find((t) => t.id === id)?.position ?? null : null);
      let position: string;
      try {
        position = positionBetween(pos(v.beforeId), pos(v.afterId));
      } catch {
        return data; // neighbours out of order locally; the server decides
      }
      return mapTasks(data, (t) => (t.id === v.taskId ? { ...t, position } : t));
    },
  });
}

/** Soft delete (6.4.5) with a 10-second Undo toast that calls restoreTask. */
export function useDeleteTask(listId: string) {
  const qc = useQueryClient();
  return useListMutation(listId, {
    run: (v: { taskId: string; title: string }) => deleteTaskAction({ taskId: v.taskId }),
    patch: (data, v) => {
      const gone = new Set([v.taskId, ...descendants(data.tasks, v.taskId)]);
      return { ...data, tasks: data.tasks.filter((t) => !gone.has(t.id)) };
    },
    onSuccess: (_r, v) => {
      toast(`Deleted "${v.title}"`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            const res = await restoreTaskAction({ taskId: v.taskId });
            if (!res.ok) toast.error(res.error.message);
            void qc.invalidateQueries({ queryKey: listViewKey(listId) });
          },
        },
      });
    },
  });
}

/** Nested / Separate is a shared per-list setting (6.3.3); the whole team sees the change. */
export function useSetSubtaskDisplay(listId: string) {
  return useListMutation(listId, {
    run: (v: { subtaskDisplay: "NESTED" | "SEPARATE" }) => updateListAction({ listId, subtaskDisplay: v.subtaskDisplay }),
    patch: (data, v) => ({ ...data, list: { ...data.list, subtaskDisplay: v.subtaskDisplay } }),
  });
}

/** Rename from the list header; the sidebar refreshes through the action's refresh(). */
export function useRenameList(listId: string) {
  return useListMutation(listId, {
    run: (v: { name: string }) => updateListAction({ listId, name: v.name }),
    patch: (data, v) => ({ ...data, list: { ...data.list, name: v.name.trim() } }),
  });
}

// ---------- cache patches (shared with use-task.ts) ----------

export type StatusChange = { taskId: string; statusId: string; completeSubtasks?: boolean };

/** Applies an updateTask input to a list view's rows (title, priority, dates, status). */
export function patchTaskFields(data: ListViewDTO, v: UpdateTaskInput): ListViewDTO {
  return mapTasks(data, (t) => {
    if (t.id !== v.taskId) return t;
    const next = { ...t };
    if (v.title !== undefined) next.title = v.title.trim();
    if (v.priority !== undefined) next.priority = v.priority as TaskRowDTO["priority"];
    if (v.startDate !== undefined) next.startDate = v.startDate;
    if (v.dueDate !== undefined) next.dueDate = v.dueDate;
    if (v.dueHasTime !== undefined || v.dueDate === null) next.dueHasTime = next.dueDate ? (v.dueHasTime ?? t.dueHasTime) : false;
    if (v.statusId !== undefined) {
      const status = data.statuses.find((s) => s.id === v.statusId);
      if (status) {
        next.status = status;
        if (status.category === "DONE" && t.status.category !== "DONE") next.completedAt = new Date().toISOString();
        if (status.category !== "DONE") next.completedAt = null;
      }
    }
    return next;
  });
}

/** Applies a status change to a list view, cascading into open descendants when asked (6.2.4). */
export function patchStatus(data: ListViewDTO, v: StatusChange): ListViewDTO {
  const status = data.statuses.find((s) => s.id === v.statusId);
  const task = data.tasks.find((t) => t.id === v.taskId);
  if (!status || !task) return data;
  const intoDone = status.category === "DONE" && task.status.category !== "DONE";
  const cascade = new Set(intoDone && v.completeSubtasks ? descendants(data.tasks, v.taskId) : []);
  const now = new Date().toISOString();
  return mapTasks(data, (t) => {
    if (t.id === v.taskId) {
      return { ...t, status, completedAt: status.category === "DONE" ? (t.completedAt ?? now) : null };
    }
    if (cascade.has(t.id) && !t.completedAt) return { ...t, status, completedAt: now };
    return t;
  });
}

// ---------- cache helpers ----------

function mapTasks(data: ListViewDTO, fn: (t: TaskRowDTO) => TaskRowDTO): ListViewDTO {
  return { ...data, tasks: data.tasks.map(fn) };
}

export function firstStatus(statuses: readonly StatusDTO[], category: StatusDTO["category"]): StatusDTO | undefined {
  return [...statuses].filter((s) => s.category === category).sort((a, b) => comparePositions(a.position, b.position))[0];
}

/** Ids of all descendants of `id` present in `tasks`. */
export function descendants(tasks: readonly TaskRowDTO[], id: string): string[] {
  const out: string[] = [];
  let frontier = [id];
  while (frontier.length) {
    const next = tasks.filter((t) => t.parentId && frontier.includes(t.parentId)).map((t) => t.id);
    out.push(...next);
    frontier = next;
  }
  return out;
}

/** Recomputes subtask counts for rows whose children are all in view (always true in Visible(L)). */
export function recount(data: ListViewDTO): ListViewDTO {
  const kids = new Map<string, TaskRowDTO[]>();
  for (const t of data.tasks) {
    if (!t.parentId) continue;
    kids.set(t.parentId, [...(kids.get(t.parentId) ?? []), t]);
  }
  return mapTasks(data, (t) => {
    const k = kids.get(t.id) ?? [];
    return { ...t, subtaskCount: k.length, openSubtaskCount: k.filter((c) => !c.completedAt).length };
  });
}
