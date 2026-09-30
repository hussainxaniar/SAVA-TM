"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IconPlus } from "@tabler/icons-react";
import { useAddSubtask, useEditTask, useReorderSubtask } from "@/hooks/use-task";
import { MAX_TASK_DEPTH, formatDue, type DueTone } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/tasks/avatar-stack";
import { StatusControl } from "@/components/tasks/status-icon";
import type { StatusDTO, TaskDetailDTO, TaskRowDTO } from "@/server/services/types";

const TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-overdue",
  today: "text-success",
  default: "",
};

/**
 * The dialog's Subtasks section (9.4.4): rows with a status control, drag to reorder and the
 * "+ Add subtask" input. Always rendered — with no subtasks it's the heading with a muted 0.
 */
export function Subtasks({ task, onOpenTask }: { task: TaskDetailDTO; onOpenTask: (taskId: string) => void }) {
  const editTask = useEditTask();
  const addSubtask = useAddSubtask();
  const reorderSubtask = useReorderSubtask();

  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const escaped = useRef(false);

  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.completedAt !== null).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const atLimit = task.depth >= MAX_TASK_DEPTH;

  const onSetStatus = useCallback(
    (t: TaskRowDTO, statusId: string, completeSubtasks?: boolean) =>
      editTask.mutate({ taskId: t.id, statusId, completeSubtasks }),
    [editTask],
  );

  const commit = useCallback(
    (keepOpen: boolean) => {
      const title = value.trim();
      setValue("");
      if (title)
        addSubtask.mutate({
          parentId: task.id,
          listId: task.homeList.id,
          title,
          tempId: `temp-${crypto.randomUUID()}`,
        });
      if (!keepOpen) setAdding(false);
    },
    [addSubtask, task.homeList.id, task.id, value],
  );

  // Drag to reorder (the whole row is the handle; the 4px activation keeps clicks working).
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => task.subtasks.map((t) => t.id), [task.subtasks]);
  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      const activeId = String(active.id);
      const overId = over ? String(over.id) : null;
      if (!overId || activeId === overId) return;
      const from = ids.indexOf(activeId);
      const to = ids.indexOf(overId);
      if (from < 0 || to < 0) return;
      const next = arrayMove(ids, from, to);
      const i = next.indexOf(activeId);
      reorderSubtask.mutate({
        parentId: task.id,
        taskId: activeId,
        listId: task.homeList.id,
        beforeId: next[i - 1] ?? null,
        afterId: next[i + 1] ?? null,
      });
    },
    [ids, reorderSubtask, task.homeList.id, task.id],
  );

  return (
    <section className="ml-10 mt-7">
      <div className="flex h-8 items-center gap-2.5">
        <h3 className="text-sm font-semibold">Subtasks</h3>
        <span className="text-[13px] text-muted-foreground">{total === 0 ? "0" : `${done}/${total}`}</span>
        {total > 0 && (
          <div aria-hidden className="ml-1.5 h-1 w-[120px] rounded-[2px] bg-pill">
            <div className="h-1 rounded-[2px] bg-success transition-width" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul>
            {task.subtasks.map((sub) => (
              <SubtaskRow
                key={sub.id}
                sub={sub}
                statuses={task.statuses}
                onOpenTask={onOpenTask}
                onSetStatus={onSetStatus}
              />
            ))}
            {atLimit ? (
              <li className="pt-1 text-[13px] text-muted-foreground">
                Subtasks can only go three levels deep.
              </li>
            ) : adding ? (
              <li className="flex h-10 items-center gap-3">
                <IconPlus aria-hidden className="size-[18px] shrink-0 text-primary" />
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Add subtask"
                  aria-label="Subtask name"
                  maxLength={500}
                  className="h-10 min-w-0 grow bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commit(true);
                    } else if (e.key === "Escape") {
                      // Close only this input, not the dialog.
                      e.preventDefault();
                      e.stopPropagation();
                      escaped.current = true;
                      setAdding(false);
                      setValue("");
                    }
                  }}
                  onBlur={() => {
                    if (escaped.current) {
                      escaped.current = false;
                      return;
                    }
                    commit(false);
                  }}
                />
              </li>
            ) : (
              <li>
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex h-10 w-full items-center gap-3 text-left"
                >
                  <IconPlus aria-hidden className="size-[18px] shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">Add subtask</span>
                </button>
              </li>
            )}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

/** One subtask row: draggable, the title opens the subtask, the control sets its status. */
function SubtaskRow({
  sub,
  statuses,
  onOpenTask,
  onSetStatus,
}: {
  sub: TaskRowDTO;
  statuses: readonly StatusDTO[];
  onOpenTask: (taskId: string) => void;
  onSetStatus: (task: TaskRowDTO, statusId: string, completeSubtasks?: boolean) => void;
}) {
  const temp = sub.id.startsWith("temp-");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sub.id,
    disabled: temp,
  });
  const done = sub.completedAt !== null;
  const due = sub.dueDate ? formatDue(sub.dueDate, sub.dueHasTime, { completed: done }) : null;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      className={cn(
        "flex h-10 items-center gap-3 border-b border-divider",
        !temp && listeners && "cursor-grab",
        isDragging && "relative z-10 cursor-grabbing opacity-50",
      )}
      {...(temp ? {} : { ...attributes, ...listeners })}
    >
      {/* The status menu is portaled but its keys still bubble to this row's drag listeners. */}
      <span className="flex shrink-0" onKeyDown={(e) => e.stopPropagation()}>
        <StatusControl task={sub} statuses={statuses} size={16} disabled={temp} onSetStatus={onSetStatus} />
      </span>
      {temp ? (
        <span className="min-w-0 flex-1 truncate text-sm">{sub.title}</span>
      ) : (
        <button
          type="button"
          onClick={() => onOpenTask(sub.id)}
          onKeyDown={(e) => e.stopPropagation()} // Enter opens the subtask, not a keyboard drag
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm",
            done && "text-muted-foreground line-through",
          )}
        >
          {sub.title}
        </button>
      )}
      {due && <span className={cn("shrink-0 text-xs", TONE_CLASS[due.tone])}>{due.label}</span>}
      <span className="flex shrink-0">
        {sub.assignees.slice(0, 3).map((user, i) => (
          <Avatar key={user.id} user={user} className={cn("size-5", i > 0 && "-ml-1.5")} />
        ))}
      </span>
    </li>
  );
}