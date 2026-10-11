"use client";

import { useEffect, useRef } from "react";
import { Draggable } from "@fullcalendar/interaction";

/*
 * Makes the rows inside a container draggable onto the FullCalendar grid, for the phone's
 * "See tasks" panel (docs/design/mobile.md, Calendar). A row is any descendant with
 * `data-task-id`, `data-title` and `data-color` (what CalendarGrid's `drop` reads). On a touch
 * screen FullCalendar starts the drag after a long press, so scrolling the panel still works.
 *
 * The panel covers the grid, and FullCalendar only accepts a drop where the grid is the topmost
 * element under the finger. `onDragStart` is therefore the moment to slide the panel away (keep
 * it mounted: FullCalendar still reads the dragged row); `onDragEnd` fires after the drop or the
 * cancel. The dragged copy carries the class `fc-event-dragging` (styled in globals.css).
 */

export const TASK_LONG_PRESS_MS = 350;

export function useTaskDragSource<T extends HTMLElement>(opts: {
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const ref = useRef<T | null>(null);
  const callbacks = useRef(opts);
  useEffect(() => {
    callbacks.current = opts;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: "[data-task-id]",
      longPressDelay: TASK_LONG_PRESS_MS,
      // `create: false`: the grid shows a 60-minute placeholder while dragging and reports the
      // drop; CalendarGrid creates the block itself (optimistically) in its `drop` handler.
      eventData: (rowEl) => ({ title: rowEl.dataset.title ?? "", duration: "01:00", create: false }),
    });
    const emitter = draggable.dragging.emitter;
    const start = () => callbacks.current.onDragStart?.();
    const end = () => callbacks.current.onDragEnd?.();
    emitter.on("dragstart", start);
    emitter.on("dragend", end);
    return () => {
      emitter.off("dragstart", start);
      emitter.off("dragend", end);
      draggable.destroy();
    };
  }, []);

  return ref;
}
