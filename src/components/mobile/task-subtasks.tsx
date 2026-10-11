"use client";

import { useCallback, useRef, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { MobileTaskRow } from "@/components/mobile/task-row";
import { useAddSubtask, useEditTask } from "@/hooks/use-task";
import { MAX_TASK_DEPTH } from "@/lib/list-view";
import type { TaskDetailDTO, TaskRowDTO } from "@/server/services/types";

/**
 * The phone task details' Subtasks section (docs/design/mobile.md "Task details"): a header with
 * the done/total count and progress bar, the phone task row for each subtask, and an "Add
 * subtask" row like the list page's inline add (unless the tree is already at its depth limit).
 */
export function MobileSubtasks({ task, onOpenTask }: { task: TaskDetailDTO; onOpenTask: (taskId: string) => void }) {
  const editTask = useEditTask();
  const addSubtask = useAddSubtask();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const cancelled = useRef(false);

  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.completedAt !== null).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const atLimit = task.depth >= MAX_TASK_DEPTH;

  const onSetStatus = useCallback(
    (t: TaskRowDTO, statusId: string, completeSubtasks?: boolean) =>
      editTask.mutate({ taskId: t.id, statusId, completeSubtasks }),
    [editTask],
  );

  const add = useCallback(() => {
    const title = value.trim();
    setValue("");
    if (title)
      addSubtask.mutate({
        parentId: task.id,
        listId: task.homeList.id,
        title,
        tempId: `temp-${crypto.randomUUID()}`,
      });
  }, [addSubtask, task.homeList.id, task.id, value]);

  return (
    <section className="border-b border-border">
      <div className="flex h-11 items-center gap-2 px-4">
        <h3 className="text-[15px] font-semibold leading-5 text-foreground">Subtasks</h3>
        <span className="text-[13px] leading-[18px] text-muted-foreground">
          {total === 0 ? "0" : `${done}/${total}`}
        </span>
        {total > 0 && (
          <div aria-hidden className="h-1 w-24 shrink-0 rounded-full bg-pill">
            <div className="h-1 rounded-full bg-success transition-width" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      {task.subtasks.map((sub) => (
        <MobileTaskRow
          key={sub.id}
          task={sub}
          statuses={task.statuses}
          onOpenTask={onOpenTask}
          onSetStatus={onSetStatus}
        />
      ))}
      {!atLimit &&
        (adding ? (
          <div className="flex h-12 items-center pl-1 pr-4">
            <span className="flex size-11 shrink-0 items-center justify-center text-primary">
              <IconPlus aria-hidden className="size-5" stroke={2} />
            </span>
            <input
              autoFocus
              aria-label="Subtask name"
              placeholder="Add subtask"
              value={value}
              maxLength={500}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => {
                if (!cancelled.current && value.trim() === "") setAdding(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  // Close only this input, not the dialog or the task sheet under it.
                  cancelled.current = true;
                  e.stopPropagation();
                  setAdding(false);
                  setValue("");
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (value.trim()) add();
                  else setAdding(false);
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              cancelled.current = false;
              setAdding(true);
            }}
            className="flex h-12 w-full items-center pl-1 pr-4 text-left text-base text-muted-foreground"
          >
            <span className="flex size-11 shrink-0 items-center justify-center text-primary">
              <IconPlus aria-hidden className="size-5" stroke={2} />
            </span>
            Add subtask
          </button>
        ))}
    </section>
  );
}