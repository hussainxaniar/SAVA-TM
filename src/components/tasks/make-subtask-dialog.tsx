"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusGlyph } from "@/components/tasks/status-icon";
import { cn } from "@/lib/utils";
import type { StatusDTO, TaskRowDTO } from "@/server/services/types";

/**
 * The "Make subtask of…" picker (9.2): search the valid parents and pick one. Keyboard-driven
 * like quick add — ↑/↓ move the highlight, Enter picks, Esc closes.
 */
export function MakeSubtaskDialog({
  open,
  onOpenChange,
  candidates,
  statuses,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** parentCandidates(): the tasks that may hold this one (three levels at most). */
  candidates: TaskRowDTO[];
  statuses: readonly StatusDTO[];
  onPick: (parentId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  // Fresh search every time it opens (state adjusted during render, not in an effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setHighlight(0);
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? candidates.filter((c) => c.title.toLowerCase().includes(q)) : candidates;
    return list.slice(0, 8);
  }, [candidates, query]);

  // Typing can shrink the matches under the highlight.
  const active = matches.length ? Math.min(highlight, matches.length - 1) : 0;

  const pick = (index: number) => {
    const candidate = matches[index];
    if (!candidate) return;
    onOpenChange(false);
    onPick(candidate.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-[480px]"
      >
        <DialogTitle className="px-4 pt-3 text-[13px] font-semibold text-muted-foreground">
          Make subtask of…
        </DialogTitle>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(active);
            }
          }}
          placeholder="Search tasks"
          aria-label="Search tasks"
          maxLength={500}
          className="w-full bg-transparent px-4 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div role="listbox" aria-label="Make subtask of" className="pb-2">
          {matches.map((candidate, i) => (
            <div
              key={candidate.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
              className={cn(
                "flex h-9 items-center gap-2 px-3 text-sm",
                i === active && "bg-accent",
              )}
            >
              <StatusGlyph status={candidate.status} statuses={statuses} size={14} />
              <span className="min-w-0 truncate">{candidate.title}</span>
              {candidate.depth === 1 && candidate.parentTitle && (
                <span className="ml-auto max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">
                  ↳ {candidate.parentTitle}
                </span>
              )}
            </div>
          ))}
          {matches.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No matching task can hold it (three levels at most).
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}