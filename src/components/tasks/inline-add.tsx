"use client";

import { useRef, useState } from "react";
import { IconPlus } from "@tabler/icons-react";

/**
 * The inline "Add task" input (group footer and the row `+`). Enter creates and keeps the field
 * open for the next task; Esc or blur-when-empty closes it.
 */
export function InlineAdd({
  indentCells,
  onCommit,
  onClose,
}: {
  /** 20px spacer cells before the "+" slot, matching the row the input replaces. */
  indentCells: number;
  onCommit: (title: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const escaped = useRef(false);

  function commit(keepOpen: boolean) {
    const title = value.trim();
    setValue("");
    if (title) onCommit(title);
    if (!keepOpen) onClose();
  }

  return (
    <div className="flex h-9 items-center border-b border-divider">
      {Array.from({ length: indentCells }, (_, i) => (
        <div key={i} className="w-5 shrink-0" />
      ))}
      <IconPlus className="mx-0.5 mr-2.5 size-4 shrink-0 text-primary" aria-hidden />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Task name"
        aria-label="Task name"
        className="h-9 min-w-0 grow bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(true);
          } else if (e.key === "Escape") {
            escaped.current = true;
            onClose();
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
    </div>
  );
}
