"use client";

import { IconPlus } from "@tabler/icons-react";
import { requestQuickAdd } from "@/lib/quick-add";

/** The floating add-task button: 56px, 16px from the right, 16px above the tab bar. */
export function AddTaskFab() {
  return (
    <button
      type="button"
      aria-label="Add task"
      onClick={requestQuickAdd}
      className="fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"
      style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      <IconPlus className="size-[26px]" stroke={2.2} />
    </button>
  );
}
