"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { comparePositions } from "@/lib/position";
import { buildGroups, type DisplayMode, type SortMode } from "@/lib/list-view";
import { QUICK_ADD_EVENT } from "@/lib/quick-add";
import {
  firstStatus,
  useCreateTask,
  useDeleteTask,
  useListView,
  useReorderTask,
  useSetCompleted,
  useUpdateTask,
} from "@/hooks/use-list-view";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { ListHeader } from "@/components/tasks/list-header";
import { StatusGroup, type AddTarget } from "@/components/tasks/status-group";
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
  const updateTask = useUpdateTask(listId);
  const createTask = useCreateTask(listId);
  const reorderTask = useReorderTask(listId);
  const deleteTask = useDeleteTask(listId);

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

  const setPriority = useCallback(
    (taskId: string, priority: Priority) => updateTask.mutate({ taskId, priority }),
    [updateTask],
  );

  const removeTask = useCallback(
    (task: TaskRowDTO) => deleteTask.mutate({ taskId: task.id, title: task.title }),
    [deleteTask],
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

  // The sidebar's "Add task" button (and Q later): open the first TODO group's inline input.
  useEffect(() => {
    function onQuickAdd() {
      const firstTodo = firstStatus(data.statuses, "TODO");
      if (!firstTodo) return;
      setGroupOverrides({ ...groupOverrides, [firstTodo.id]: true });
      setAdd({ statusId: firstTodo.id });
    }
    window.addEventListener(QUICK_ADD_EVENT, onQuickAdd);
    return () => window.removeEventListener(QUICK_ADD_EVENT, onQuickAdd);
  }, [data.statuses, groupOverrides, setGroupOverrides]);

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
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
    [rootIdsByStatus, reorderTask],
  );

  // Stable id: dnd-kit's global aria counter differs between server and client renders.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const rowProps = {
    onToggleCollapsed: toggleCollapsed,
    onOpenTask: openTask,
    onComplete: complete,
    onSetPriority: setPriority,
    onDeleteTask: removeTask,
    onAddChild: addChild,
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
          onDragEnd={onDragEnd}
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
        </DndContext>
      </div>
    </div>
  );
}
