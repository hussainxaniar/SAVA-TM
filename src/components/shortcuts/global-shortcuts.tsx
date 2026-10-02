"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHOW_SHORTCUTS_EVENT, useGlobalShortcuts } from "@/hooks/use-global-shortcuts";

/** The help table (9.7): key chips on the left, the action on the right. */
const ROWS: { keys: string[]; action: string }[] = [
  { keys: ["Q"], action: "Quick add" },
  { keys: ["/"], action: "Focus search (v2)" },
  { keys: ["["], action: "Toggle sidebar" },
  { keys: ["Esc"], action: "Close the task dialog / any dialog" },
  { keys: ["J", "K"], action: "Next / previous task in list" },
  { keys: ["Enter"], action: "Open selected task" },
  { keys: ["X"], action: "Complete selected task" },
  { keys: ["1–4"], action: "Set priority of selected task" },
  { keys: ["G", "M"], action: "Go to My Tasks" },
  { keys: ["G", "C"], action: "Go to Calendar" },
];

/** Same chip the sidebar's "Add task" row uses for its `Q`. */
function KeyChip({ children }: { children: string }) {
  return (
    <span className="rounded-[4px] border border-border bg-background px-[5px] text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Owns the global shortcuts (9.7) and the "Keyboard shortcuts" help dialog, opened by `?` and
 * by the user menu's item (`sava:show-shortcuts`). Mounted once in the space shell.
 */
export function GlobalShortcuts({ spaceId }: { spaceId: string }) {
  const [open, setOpen] = useState(false);
  useGlobalShortcuts({ spaceId });

  useEffect(() => {
    function onShow() {
      setOpen(true);
    }
    window.addEventListener(SHOW_SHORTCUTS_EVENT, onShow);
    return () => window.removeEventListener(SHOW_SHORTCUTS_EVENT, onShow);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2.5">
          {ROWS.map((row) => (
            <div key={row.action} className="flex items-center gap-3">
              <span className="flex w-20 shrink-0 gap-1">
                {row.keys.map((k) => (
                  <KeyChip key={k}>{k}</KeyChip>
                ))}
              </span>
              <span className="text-sm text-muted-foreground">{row.action}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
