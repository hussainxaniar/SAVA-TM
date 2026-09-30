"use client";

import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { comparePositions } from "@/lib/position";
import { buildGroups, parentCandidates, type DisplayMode, type SortMode } from "@/lib/list-view";
import { rememberLastList } from "@/lib/last-list";
import { publishTaskOrder } from "@/lib/task-nav";
import {
  useCreateTask,
  useDeleteTask,
  useListView,
  useReorderTask,
  useSetCompleted,
  useSetStatus,
  useUpdateTask,
} from "@/hooks/use-list-view";
import {
  useAddToList,
  useMoveTask,
  useRemoveFromList,
  useSetParent,
} from "@/hooks/use-task";
import { useSidebarDrop } from "@/hooks/use-sidebar-drop";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { ListHeader } from "@/components/tasks/list-header";
import { StatusGroup, type AddTarget } from "@/components/tasks/status-group";
import { StatusGlyph } from "@/components/tasks/status-icon";
import type { ListViewDTO, Priority, TaskRowDTO } from "@/server/services/types";

export type ListViewProps = {
  initialData: ListViewDTO;
  spaceId: string;
  /** Owner/Admin: may delete lists (7.3). */
  canDeleteLists: boolean;
};

/**
 * Section 9.2 list view (docs/design/list-view-*.jpg): status groups over the shared
 * `['tasks', listId]` cache, with all mutations going through the optimistic hooks.
 */
export function ListView({ initialData, spaceId, canDeleteLists }: ListViewProps) {
  const listId = initialData.list.id;
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useListView(listId, initialData);

  // Per-browser view preferences (6.7): group collapse, sort, collapsed subtrees.
  const [groupOverrides, setGroupOverrides] = useLocalStorage(
    `sava.list.${listId}.groups`,
    {} as Record<string, boolean>,
  );
  const [showCompleted, setShowCompleted] = useLocalStorage(
    `sava.list.${listId}.showCompleted`,
    false,
  );
  const [sort, setSort] = useLocalStorage(`sava.list.${listId}.sort`, "manual" as SortMode);
  const [collapsedIds, setCollapsedIds] = useLocalStorage(
    `sava.list.${listId}.collapsed`,
    [] as string[],
  );

  const [add, setAdd] = useState<AddTarget | null>(null);
  const collapsed = useMemo(() => new Set(collapsedIds), [collapsedIds]);

  const setCompleted = useSetCompleted(listId);
  const setStatus = useSetStatus(listId);
  const updateTask = useUpdateTask(listId);
  const createTask = useCreateTask(listId);
  const reorderTask = useReorderTask(listId);
  const deleteTask = useDeleteTask(listId);
  const setParent = useSetParent();
  const moveTask = useMoveTask();
  const addToListMutation = useAddToList();
  const removeFromListMutation = useRemoveFromList();
  const sidebarDrop = useSidebarDrop();

  const mode: DisplayMode = data.list.subtaskDisplay;
  const groups = useMemo(
    () => buildGroups(data.tasks, data.statuses, { mode, sort, collapsed }),
    [data.tasks, data.statuses, mode, sort, collapsed],
  );

  // Manual sort only: root tasks per status group, in position order (drop math + SortableContext).
  const draggable = sort === "manual";
  const rootIdsByStatus = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!draggable) return map;
    const inView = new Set(data.tasks.map((t) => t.id));
    for (const status of data.statuses) {
      const roots = data.tasks
        .filter(
          (t) =>
            t.status.id === status.id && (!t.parentId || !inView.has(t.parentId)),
        )
        .sort((a, b) => comparePositions(a.position, b.position))
        .map((t) => t.id);
      map.set(status.id, roots);
    }
    return map;
  }, [data.tasks, data.statuses, draggable]);

  const openTask = useCallback(
    (taskId: string) => router.replace(`${pathname}?task=${taskId}`, { scroll: false }),
    [router, pathname],
  );

  const complete = useCallback(
    (task: TaskRowDTO, opts: { completed: boolean; includeSubtasks?: boolean }) =>
      setCompleted.mutate({
        taskId: task.id,
        completed: opts.completed,
        includeSubtasks: opts.includeSubtasks,
      }),
    [setCompleted],
  );

  const changeStatus = useCallback(
    (task: TaskRowDTO, statusId: string, completeSubtasks?: boolean) =>
      setStatus.mutate({ taskId: task.id, statusId, completeSubtasks }),
    [setStatus],
  );

  const setPriority = useCallback(
    (taskId: string, priority: Priority) => updateTask.mutate({ taskId, priority }),
    [updateTask],
  );

  const removeTask = useCallback(
    (task: TaskRowDTO) => deleteTask.mutate({ taskId: task.id, title: task.title }),
    [deleteTask],
  );

  // Valid parents per task, computed on demand (row menu and its picker, 6.4.3).
  const candidatesFor = useCallback(
    (taskId: string) => parentCandidates(data.tasks, taskId),
    [data.tasks],
  );

  const makeSubtaskOf = useCallback(
    async (task: TaskRowDTO, parentId: string) => {
      try {
        await setParent.mutateAsync({ taskId: task.id, parentId });
        const parent = data.tasks.find((t) => t.id === parentId);
        if (parent) toast.success(`Moved under "${parent.title}"`);
      } catch {
        // the hook toasted the failure
      }
    },
    [setParent, data.tasks],
  );

  const convertToTask = useCallback(
    async (task: TaskRowDTO) => {
      try {
        await setParent.mutateAsync({ taskId: task.id, parentId: null });
        toast.success("Converted to a task");
      } catch {
        // the hook toasted the failure
      }
    },
    [setParent],
  );

  // Move / link handlers (6.5, 6.6): failures toast inside the hooks; success here.
  const moveToList = useCallback(
    async (task: TaskRowDTO, targetId: string) => {
      const list = data.project.lists.find((l) => l.id === targetId);
      try {
        await moveTask.mutateAsync({ taskId: task.id, fromListId: task.homeListId, toListId: targetId });
        if (list) toast.success(`Moved to "${list.name}"`);
      } catch {
        // the hook toasted the failure
      }
    },
    [moveTask, data.project.lists],
  );

  const addToList = useCallback(
    async (task: TaskRowDTO, targetId: string) => {
      const list = data.project.lists.find((l) => l.id === targetId);
      try {
        await addToListMutation.mutateAsync({ taskId: task.id, listId: targetId });
        if (list) toast.success(`Added to "${list.name}"`);
      } catch {
        // the hook toasted the failure
      }
    },
    [addToListMutation, data.project.lists],
  );

  const removeFromList = useCallback(
    async (task: TaskRowDTO) => {
      try {
        await removeFromListMutation.mutateAsync({ taskId: task.id, listId });
        toast.success(`Removed from "${data.list.name}"`);
      } catch {
        // the hook toasted the failure
      }
    },
    [removeFromListMutation, listId, data.list.name],
  );

  const toggleCollapsed = useCallback(
    (taskId: string) =>
      setCollapsedIds(
        collapsedIds.includes(taskId)
          ? collapsedIds.filter((id) => id !== taskId)
          : [...collapsedIds, taskId],
      ),
    [collapsedIds, setCollapsedIds],
  );

  const addChild = useCallback(
    (task: TaskRowDTO) => {
      setAdd({ parentId: task.id });
      if (collapsedIds.includes(task.id))
        setCollapsedIds(collapsedIds.filter((id) => id !== task.id));
    },
    [collapsedIds, setCollapsedIds],
  );

  const create = useCallback(
    (input: { title: string; statusId?: string; parentId?: string }) => {
      createTask.mutate({
        tempId: `temp-${crypto.randomUUID()}`,
        listId,
        title: input.title,
        statusId: input.statusId ?? null,
        parentId: input.parentId ?? null,
      });
    },
    [createTask, listId],
  );

  // Remember the open list as the space's last used one (quick add's fallback target).
  useEffect(() => {
    rememberLastList(spaceId, listId);
  }, [spaceId, listId]);

  // The rows on screen, in order (T-11): the task dialog's ↑/↓ steps through them.
  const isGroupOpen = useCallback(
    (statusId: string) =>
      groupOverrides[statusId] ??
      // The same rule the render uses: DONE groups follow "Show completed".
      (data.statuses.find((s) => s.id === statusId)?.category === "DONE" ? showCompleted : true),
    [groupOverrides, data.statuses, showCompleted],
  );
  const rowOrder = useMemo(() => {
    const ids: string[] = [];
    for (const group of groups) {
      if (!isGroupOpen(group.status.id)) continue;
      for (const row of group.rows) if (!row.task.id.startsWith("temp-")) ids.push(row.task.id);
    }
    return ids;
  }, [groups, isGroupOpen]);
  useEffect(() => {
    publishTaskOrder(rowOrder);
  }, [rowOrder]);
  useEffect(() => () => publishTaskOrder([]), []);

  // Dropping a row on a sidebar list (6.5/6.6): only lists of this project, never the current
  // one; a move needs a top-level task and a list that isn't its home, an add skips linked lists.
  const isValidFor = useCallback(
    (task: TaskRowDTO) => (targetId: string, dropMode: "move" | "add") =>
      targetId !== listId &&
      data.project.lists.some((l) => l.id === targetId) &&
      targetId !== task.homeListId &&
      (dropMode === "add" ? !task.linkedListIds.includes(targetId) : task.parentId === null),
    [listId, data.project.lists],
  );

  // The row being dragged, shown as a DragOverlay card that follows the pointer: the list's
  // scroll container clips the row itself once it leaves the list (e.g. towards the sidebar).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingTask = draggingId ? data.tasks.find((t) => t.id === draggingId) : undefined;
  // The overlay portals into <body>, which only exists after hydration (false on the server).
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const onDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const task = data.tasks.find((t) => t.id === String(active.id));
      setDraggingId(task?.id ?? null);
      sidebarDrop.begin(task ? isValidFor(task) : () => false);
    },
    [sidebarDrop, data.tasks, isValidFor],
  );

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setDraggingId(null);
      const drop = sidebarDrop.end();
      if (drop) {
        const task = data.tasks.find((t) => t.id === String(active.id));
        if (task) {
          if (drop.mode === "move") void moveToList(task, drop.listId);
          else void addToList(task, drop.listId);
        }
        return;
      }
      const activeId = String(active.id);
      const overId = over ? String(over.id) : null;
      if (!overId || activeId === overId) return;
      for (const ids of rootIdsByStatus.values()) {
        const from = ids.indexOf(activeId);
        const to = ids.indexOf(overId);
        if (from < 0 || to < 0) continue;
        const next = arrayMove(ids, from, to);
        const i = next.indexOf(activeId);
        reorderTask.mutate({
          taskId: activeId,
          beforeId: next[i - 1] ?? null,
          afterId: next[i + 1] ?? null,
        });
        return;
      }
    },
    [sidebarDrop, data.tasks, moveToList, addToList, rootIdsByStatus, reorderTask],
  );

  const onDragCancel = useCallback(() => {
    setDraggingId(null);
    sidebarDrop.end();
  }, [sidebarDrop]);

  // Stable id: dnd-kit's global aria counter differs between server and client renders.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const rowProps = {
    statuses: data.statuses,
    onToggleCollapsed: toggleCollapsed,
    onOpenTask: openTask,
    onComplete: complete,
    onSetStatus: changeStatus,
    onSetPriority: setPriority,
    onDeleteTask: removeTask,
    onAddChild: addChild,
    onMakeSubtaskOf: makeSubtaskOf,
    onConvertToTask: convertToTask,
    onMoveToList: moveToList,
    onAddToList: addToList,
    onRemoveFromList: removeFromList,
    candidatesFor,
    lists: data.project.lists,
  };

  return (
    <div>
      <ListHeader
        data={data}
        spaceId={spaceId}
        canDeleteLists={canDeleteLists}
        sort={sort}
        showCompleted={showCompleted}
        onSort={setSort}
        onShowCompleted={setShowCompleted}
      />
      <div className="mx-auto w-full max-w-[880px] px-6 pt-1 pb-24">
        {data.tasks.length === 0 && (
          <p className="mt-7 text-sm text-muted-foreground">
            No tasks yet — press Q to add one
          </p>
        )}
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          {groups.map((group, i) => (
            <StatusGroup
              key={group.status.id}
              group={group}
              mode={mode}
              open={
                groupOverrides[group.status.id] ??
                (group.status.category === "DONE" ? showCompleted : true)
              }
              onToggleOpen={() =>
                setGroupOverrides({
                  ...groupOverrides,
                  [group.status.id]: !(
                    groupOverrides[group.status.id] ??
                    (group.status.category === "DONE" ? showCompleted : true)
                  ),
                })
              }
              showColumns={mode === "NESTED" && i === 0}
              draggable={draggable}
              rootIds={rootIdsByStatus.get(group.status.id) ?? []}
              add={add}
              onAddStatus={(statusId) => setAdd({ statusId })}
              onCancelAdd={() => setAdd(null)}
              onCreate={create}
              collapsed={collapsed}
              rowProps={rowProps}
              className={i === 0 ? "mt-7" : "mt-6"}
            />
          ))}
          {hydrated &&
            createPortal(
              <DragOverlay dropAnimation={null} modifiers={[besidePointer]}>
                {draggingTask ? (
                  <div className="flex h-9 w-[360px] cursor-grabbing items-center gap-2.5 rounded-md border bg-background px-3 text-sm shadow-lg">
                    <StatusGlyph status={draggingTask.status} statuses={data.statuses} size={16} />
                    <span className="truncate">{draggingTask.title}</span>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )}
        </DndContext>
      </div>
    </div>
  );
}

const noopSubscribe = () => () => {};

/**
 * Keeps the drag card just below and right of the pointer instead of where the row started, so
 * it never covers the sidebar list (and its "Move here" label) under the pointer.
 */
const besidePointer: Modifier = ({ transform, activatorEvent, draggingNodeRect }) => {
  if (!draggingNodeRect || !activatorEvent || !("clientX" in activatorEvent)) return transform;
  const start = activatorEvent as PointerEvent;
  return {
    ...transform,
    x: transform.x + start.clientX - draggingNodeRect.left + 12,
    y: transform.y + start.clientY - draggingNodeRect.top + 14,
  };
};
