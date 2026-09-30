"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { InlineAdd } from "@/components/tasks/inline-add";
import { StatusGlyph } from "@/components/tasks/status-icon";
import { TaskRow, type DragHandle, type TaskRowProps } from "@/components/tasks/task-row";
import type { DisplayMode, ListRow, StatusGroup as StatusGroupData } from "@/lib/list-view";
import { cn } from "@/lib/utils";

/** Which inline-add input is open: a group's "Add task" or a row's `+`. */
export type AddTarget = { statusId: string } | { parentId: string };

export type StatusGroupProps = {
  group: StatusGroupData;
  mode: DisplayMode;
  open: boolean;
  onToggleOpen: () => void;
  /** NESTED + first group: the "Subs / Assignee / Due / Pri" column labels. */
  showColumns: boolean;
  draggable: boolean;
  /** Root ids of this group in position order (manual sort): SortableContext + drop math. */
  rootIds: string[];
  add: AddTarget | null;
  onAddStatus: (statusId: string) => void;
  onCancelAdd: () => void;
  onCreate: (input: { title: string; statusId?: string; parentId?: string }) => void;
  collapsed: ReadonlySet<string>;
  rowProps: Omit<TaskRowProps, "row" | "mode" | "dragHandle" | "collapsed">;
  className?: string;
};

/** dnd-kit wrapper: the sortable node is the root row plus its subtree (NESTED), so they move together. */
function SortableBlock({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (handle: DragHandle | null) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      className={isDragging ? "relative z-10" : undefined}
    >
      {children(
        disabled
          ? null
          : {
              attributes: attributes as unknown as Record<string, unknown>,
              listeners: listeners as unknown as Record<string, unknown> | undefined,
              isDragging,
            },
      )}
    </div>
  );
}

/**
 * One status group: collapsible header (pill + count), its rows and the "Add task" footer.
 * In NESTED mode rows are chunked per root so each subtree drags as one unit.
 */
export function StatusGroup({
  group,
  mode,
  open,
  onToggleOpen,
  showColumns,
  draggable,
  rootIds,
  add,
  onAddStatus,
  onCancelAdd,
  onCreate,
  collapsed,
  rowProps,
  className,
}: StatusGroupProps) {
  const { status } = group;
  const done = status.category === "DONE";
  const parentId = add && "parentId" in add ? add.parentId : null;

  // Chunk rows: NESTED groups a root and its descendants; SEPARATE makes every row a unit.
  const blocks = useMemo(() => {
    const out: { start: number; rows: ListRow[] }[] = [];
    if (mode === "SEPARATE") {
      group.rows.forEach((row, i) => out.push({ start: i, rows: [row] }));
      return out;
    }
    let current: { start: number; rows: ListRow[] } | null = null;
    group.rows.forEach((row, i) => {
      if (!current || row.indent === 0) {
        current = { start: i, rows: [row] };
        out.push(current);
      } else {
        current.rows.push(row);
      }
    });
    return out;
  }, [group.rows, mode]);

  // Where the row `+` input goes: right after the parent's subtree (NESTED) or its row (SEPARATE).
  const insertIndex = useMemo(() => {
    if (!parentId) return -1;
    const i = group.rows.findIndex((r) => r.task.id === parentId);
    if (i < 0) return -1;
    if (mode === "SEPARATE") return i;
    let end = i;
    while (end + 1 < group.rows.length && group.rows[end + 1].indent > group.rows[i].indent) end++;
    return end;
  }, [group.rows, mode, parentId]);

  const parentIndent = insertIndex >= 0 ? group.rows[insertIndex].indent : 0;
  const addIndentCells = mode === "NESTED" ? parentIndent + 2 : 1;
  const rootIdSet = useMemo(() => new Set(rootIds), [rootIds]);

  function renderRow(row: ListRow, dragHandle: DragHandle | null) {
    return (
      <TaskRow
        {...rowProps}
        row={row}
        mode={mode}
        dragHandle={dragHandle}
        collapsed={collapsed.has(row.task.id)}
      />
    );
  }

  return (
    <section className={className}>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex h-8 w-full items-center border-b border-border"
      >
        <span className="flex w-5 shrink-0 justify-center text-muted-foreground">
          {open ? (
            <ChevronDown className="size-3" strokeWidth={3} />
          ) : (
            <ChevronRight className="size-3" strokeWidth={3} />
          )}
        </span>
        <span
          className={cn(
            "flex h-6 shrink-0 items-center gap-2 rounded-md bg-pill pl-2 pr-2.5",
            done && "bg-done",
          )}
        >
          <StatusGlyph category={status.category} size={14} pill />
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.04em] text-foreground/80",
              done && "text-white",
            )}
          >
            {status.name}
          </span>
        </span>
        <span className="ml-2 text-[13px] text-muted-foreground">{group.count}</span>
        {showColumns && (
          <>
            <span className="grow" />
            <span className="w-14 shrink-0 text-left text-xs text-muted-foreground">Subs</span>
            <span className="w-[72px] shrink-0 text-left text-xs text-muted-foreground">Assignee</span>
            <span className="w-24 shrink-0 text-left text-xs text-muted-foreground">Due</span>
            <span className="w-8 shrink-0 text-center text-xs text-muted-foreground">Pri</span>
          </>
        )}
      </button>

      {open && (
        <SortableContext items={draggable ? rootIds : []} strategy={verticalListSortingStrategy}>
          {blocks.map((block) => {
            const rootId = block.rows[0].task.id;
            const disabled = !draggable || !rootIdSet.has(rootId) || rootId.startsWith("temp-");
            return (
              <SortableBlock key={rootId} id={rootId} disabled={disabled}>
                {(handle) =>
                  block.rows.map((row, j) => (
                    <Fragment key={row.task.id}>
                      {renderRow(row, j === 0 ? handle : null)}
                      {block.start + j === insertIndex && (
                        <InlineAdd
                          indentCells={addIndentCells}
                          onCommit={(title) => onCreate({ title, parentId: parentId! })}
                          onClose={onCancelAdd}
                        />
                      )}
                    </Fragment>
                  ))
                }
              </SortableBlock>
            );
          })}
          {insertIndex === group.rows.length && parentId && (
            <InlineAdd
              indentCells={addIndentCells}
              onCommit={(title) => onCreate({ title, parentId })}
              onClose={onCancelAdd}
            />
          )}
          {!done &&
            (add && "statusId" in add && add.statusId === status.id ? (
              <InlineAdd
                indentCells={mode === "NESTED" ? 2 : 1}
                onCommit={(title) => onCreate({ title, statusId: status.id })}
                onClose={onCancelAdd}
              />
            ) : (
              <button
                type="button"
                onClick={() => onAddStatus(status.id)}
                className="flex h-9 w-full items-center"
              >
                {Array.from({ length: mode === "NESTED" ? 2 : 1 }, (_, i) => (
                  <span key={i} className="w-5 shrink-0" />
                ))}
                <Plus className="mx-0.5 mr-2.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="text-sm text-muted-foreground">Add task</span>
              </button>
            ))}
        </SortableContext>
      )}
    </section>
  );
}
