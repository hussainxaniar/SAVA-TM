"use client";

import { useId, useState, type ReactNode } from "react";
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
import { cn } from "@/lib/utils";

/**
 * Shared drag-and-drop list for the project settings editors — the same approach as
 * project-tree.tsx: @dnd-kit/core + sortable only, a stable DndContext id, an optimistic
 * order reset from props during render, and the reorder action called with the ids of
 * the rows that now sit directly above and below the moved one.
 */
export function SortableRows<T extends { id: string }>({
  items: propItems,
  onReorder,
  children,
}: {
  items: T[];
  /** Return false to snap the list back to the last server order (the caller toasts). */
  onReorder: (
    movedId: string,
    beforeId: string | null,
    afterId: string | null,
  ) => Promise<boolean>;
  /** Render prop receives the (optimistically reordered) items. */
  children: (items: T[]) => ReactNode;
}) {
  const [items, setItems] = useState(propItems);
  const [prev, setPrev] = useState(propItems);
  if (propItems !== prev) {
    setPrev(propItems);
    setItems(propItems);
  }

  // Stable id: without it dnd-kit numbers its aria ids with a global counter, which differs
  // between the server and client renders (hydration mismatch).
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(items, from, to);
    setItems(next);
    const i = next.findIndex((item) => item.id === active.id);
    const ok = await onReorder(
      String(active.id),
      next[i - 1]?.id ?? null,
      next[i + 1]?.id ?? null,
    );
    if (!ok) setItems(propItems);
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="divide-y rounded-lg border">{children(items)}</div>
      </SortableContext>
    </DndContext>
  );
}

/**
 * One settings row: the whole row is the drag target (a 4px move starts the drag, so clicks,
 * selects and inputs still work). `attributes` gives it `aria-roledescription="sortable"` and
 * the other dnd-kit sortable semantics; the tooltip tells mouse users it drags.
 */
export function SortableRow({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
      className={cn(
        "flex cursor-grab items-center gap-3 px-4 py-2.5",
        isDragging && "relative z-10 cursor-grabbing opacity-50",
        className,
      )}
      title="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
