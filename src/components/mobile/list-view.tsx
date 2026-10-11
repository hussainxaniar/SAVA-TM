"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconPlus,
} from "@tabler/icons-react";
import { AddTaskFab } from "@/components/mobile/fab";
import { ListMenuSheet } from "@/components/mobile/list-menu-sheet";
import { HeaderIconButton } from "@/components/mobile/screen-header";
import { MobileTaskRow } from "@/components/mobile/task-row";
import { StatusGlyph } from "@/components/tasks/status-icon";
import { useCreateTask, useListView, useSetStatus } from "@/hooks/use-list-view";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { buildGroups, type SortMode } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import type { ListViewDTO, StatusDTO, TaskRowDTO } from "@/server/services/types";

type MobileListViewProps = {
  initialData: ListViewDTO;
  spaceId: string;
  /** Owner/Admin: may delete lists (7.3). Unused on the phone so far. */
  canDeleteLists: boolean;
};

/**
 * The list page on a phone (docs/design/mobile.md "List page"): a back link to the All tasks
 * tab, the project/title block, and one collapsible section per status over the same data,
 * localStorage keys and optimistic hooks the desktop list view uses.
 */
export function MobileListView({ initialData, spaceId }: MobileListViewProps) {
  const listId = initialData.list.id;
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useListView(listId, initialData);

  // The desktop view's per-browser preferences (6.7): the same keys, so both layouts agree.
  const [groupOverrides, setGroupOverrides] = useLocalStorage(
    `sava.list.${listId}.groups`,
    {} as Record<string, boolean>,
  );
  const [showCompleted, setShowCompleted] = useLocalStorage(
    `sava.list.${listId}.showCompleted`,
    false,
  );
  const [sort] = useLocalStorage(`sava.list.${listId}.sort`, "manual" as SortMode);

  const [menuOpen, setMenuOpen] = useState(false);
  // One inline add at a time; the group's id (or the first To-do's for the empty list).
  const [addingStatusId, setAddingStatusId] = useState<string | null>(null);

  const setStatus = useSetStatus(listId);
  const createTask = useCreateTask(listId);

  const groups = useMemo(
    () =>
      buildGroups(data.tasks, data.statuses, {
        mode: data.list.subtaskDisplay,
        sort,
        collapsed: new Set(),
      }),
    [data.tasks, data.statuses, data.list.subtaskDisplay, sort],
  );

  const openCount = useMemo(
    () => data.tasks.filter((t) => t.completedAt === null).length,
    [data.tasks],
  );

  const firstTodoStatusId = useMemo(
    () => groups.find((g) => g.status.category === "TODO")?.status.id ?? null,
    [groups],
  );

  const isGroupOpen = useCallback(
    (status: StatusDTO) =>
      groupOverrides[status.id] ?? (status.category === "DONE" ? showCompleted : true),
    [groupOverrides, showCompleted],
  );

  const toggleGroup = useCallback(
    (status: StatusDTO) => {
      setGroupOverrides({ ...groupOverrides, [status.id]: !isGroupOpen(status) });
    },
    [groupOverrides, isGroupOpen, setGroupOverrides],
  );

  // The + next to a header opens the (possibly closed) group and starts adding there.
  const addTo = useCallback(
    (status: StatusDTO) => {
      setGroupOverrides({ ...groupOverrides, [status.id]: true });
      setAddingStatusId(status.id);
    },
    [groupOverrides, setGroupOverrides],
  );

  const create = useCallback(
    (title: string, statusId: string) => {
      createTask.mutate({
        tempId: `temp-${crypto.randomUUID()}`,
        listId,
        title,
        statusId,
        parentId: null,
      });
    },
    [createTask, listId],
  );

  const openTask = useCallback(
    (taskId: string) => router.replace(`${pathname}?task=${taskId}`, { scroll: false }),
    [router, pathname],
  );

  const changeStatus = useCallback(
    (task: TaskRowDTO, statusId: string, completeSubtasks?: boolean) =>
      setStatus.mutate({ taskId: task.id, statusId, completeSubtasks }),
    [setStatus],
  );

  const empty = data.tasks.length === 0;

  return (
    <div>
      <nav className="flex h-11 items-center px-1">
        <Link
          href={`/s/${spaceId}/all`}
          className="flex h-11 items-center gap-0.5 pl-1.5 pr-2 text-base text-primary"
        >
          <IconChevronLeft className="size-6" stroke={2} />
          All tasks
        </Link>
        <span className="min-w-0 flex-1" />
        <HeaderIconButton label="List options" onClick={() => setMenuOpen(true)}>
          <IconDots className="size-6 text-foreground" stroke={2.2} />
        </HeaderIconButton>
      </nav>
      <div className="flex flex-col gap-0.5 px-4 pb-3 pt-1">
        <div className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: data.project.color }}
          />
          <span className="text-[13px] leading-[18px] text-muted-foreground">{data.project.name}</span>
        </div>
        <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-foreground">
          {data.list.name}
        </h1>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {openCount} task{openCount === 1 ? "" : "s"} · {data.statuses.length} status
          {data.statuses.length === 1 ? "" : "es"}
        </p>
      </div>
      {empty ? (
        <div className="px-10 pt-16 text-center">
          <p className="text-[15px] text-muted-foreground">No tasks in this list yet.</p>
          {firstTodoStatusId && (
            <button
              type="button"
              onClick={() => setAddingStatusId(firstTodoStatusId)}
              className="mt-4 h-12 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
            >
              Add task
            </button>
          )}
          {addingStatusId && (
            <InlineAddRow
              onCommit={(title) => create(title, addingStatusId)}
              onClose={() => setAddingStatusId(null)}
            />
          )}
        </div>
      ) : (
        <div className="pb-24">
          {groups.map((group, i) => {
            const open = isGroupOpen(group.status);
            const showAddHere = open && addingStatusId === group.status.id;
            // When nothing is being added, the first To-do group ends with the "Add task" row.
            const showAddRow =
              open &&
              addingStatusId === null &&
              group.status.id === firstTodoStatusId;
            return (
              <section key={group.status.id} className={i === 0 ? undefined : "mt-5"}>
                <div className="flex h-11 items-center border-b border-border pl-3 pr-1">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleGroup(group.status)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {open ? (
                      <IconChevronDown className="size-5 shrink-0 text-muted-foreground" stroke={2} />
                    ) : (
                      <IconChevronRight className="size-5 shrink-0 text-muted-foreground" stroke={2} />
                    )}
                    <span
                      className={cn(
                        "flex h-6 shrink-0 items-center gap-1.5 rounded-md pl-1.5 pr-2",
                        group.status.category === "DONE" ? "bg-done text-white" : "bg-pill text-body",
                      )}
                    >
                      <StatusGlyph status={group.status} statuses={data.statuses} size={14} pill />
                      <span className="text-xs font-semibold uppercase tracking-[0.04em]">
                        {group.status.name}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                      {group.count}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Add task to ${group.status.name}`}
                    onClick={() => addTo(group.status)}
                    className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"
                  >
                    <IconPlus className="size-5" stroke={2} />
                  </button>
                </div>
                {open &&
                  group.rows.map((row) => (
                    <MobileTaskRow
                      key={row.task.id}
                      task={row.task}
                      statuses={data.statuses}
                      nested={row.indent > 0}
                      onOpenTask={openTask}
                      onSetStatus={changeStatus}
                    />
                  ))}
                {showAddHere && (
                  <InlineAddRow
                    onCommit={(title) => create(title, group.status.id)}
                    onClose={() => setAddingStatusId(null)}
                  />
                )}
                {showAddRow && (
                  <button
                    type="button"
                    onClick={() => setAddingStatusId(group.status.id)}
                    className="flex h-12 w-full items-center pl-1 pr-4 text-base text-muted-foreground"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center text-primary">
                      <IconPlus className="size-5" stroke={2} />
                    </span>
                    Add task
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
      <ListMenuSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        data={data}
        spaceId={spaceId}
        showCompleted={showCompleted}
        onShowCompleted={setShowCompleted}
      />
      <AddTaskFab />
    </div>
  );
}

/**
 * The inline add row: a 44px plus and an auto-focused input. Enter with text creates the task
 * and keeps the row up; Enter or blur on an empty field closes it; Escape closes without
 * creating (the cancelled flag keeps the blur that follows from doing anything).
 */
function InlineAddRow({
  onCommit,
  onClose,
}: {
  onCommit: (title: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const cancelled = useRef(false);
  return (
    <div className="flex h-12 items-center pl-1 pr-4">
      <span className="flex size-11 shrink-0 items-center justify-center text-primary">
        <IconPlus className="size-5" stroke={2} />
      </span>
      <input
        autoFocus
        aria-label="Task name"
        placeholder="Task name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (!cancelled.current && value.trim() === "") onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            cancelled.current = true;
            e.stopPropagation();
            onClose();
          } else if (e.key === "Enter") {
            const title = value.trim();
            if (title) {
              onCommit(title);
              setValue("");
            } else {
              onClose();
            }
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}