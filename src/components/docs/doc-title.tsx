"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useRenameDoc } from "@/hooks/use-doc";

/**
 * The doc view header's 28px title, inline-renameable like the list header's name (11.1). Click
 * turns it into an input; Enter or blur saves, Esc cancels (the `escaped` ref keeps the blur after
 * Esc from saving). The rename action refresh()es the server-rendered header and the sidebar, so a
 * saved name is shown from local state until the prop title catches up — and rolls back to it on a
 * failed rename.
 */
export function DocTitle({ docId, title }: { docId: string; title: string }) {
  const rename = useRenameDoc(docId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saved, setSaved] = useState<string | null>(null);
  const [prevTitle, setPrevTitle] = useState(title);
  const escaped = useRef(false);

  // When the refreshed prop arrives, drop the local value and follow the prop again.
  if (prevTitle !== title) {
    setPrevTitle(title);
    setSaved(null);
  }
  const value = saved ?? title;

  function startRename() {
    setDraft(value);
    escaped.current = false;
    setEditing(true);
  }

  function saveRename() {
    setEditing(false);
    const name = draft.trim();
    if (!name || name === value) return;
    setSaved(name);
    rename.mutate({ title: name }, { onError: () => setSaved(null) });
  }

  return editing ? (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          saveRename();
        } else if (e.key === "Escape") {
          escaped.current = true;
          setEditing(false);
        }
      }}
      onBlur={() => {
        if (escaped.current) {
          escaped.current = false;
          return;
        }
        saveRename();
      }}
      aria-label="Doc name"
      className="h-11 border-0 px-0 text-[28px] font-semibold tracking-[-0.02em] focus-visible:ring-1"
    />
  ) : (
    <h1 className="min-w-0">
      <button
        type="button"
        onClick={startRename}
        title="Rename doc"
        className="block max-w-full truncate text-left text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-foreground"
      >
        {value}
      </button>
    </h1>
  );
}