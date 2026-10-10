"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { SlashItem } from "@/lib/slash-items";
import { SlashMenuList } from "./slash-menu-list";

/*
 * The "/" menu's controller (Section 11.5): which item is highlighted and the keys. ArrowUp / ArrowDown
 * move (wrapping), Enter or Tab apply, the mouse hovers and clicks through SlashMenuList. Escape is
 * handled by the suggestion plugin itself. The extension calls `onKeyDown` for every key while the
 * menu is open; returning true keeps the key from reaching the editor. With no results Enter is left
 * to the editor (it just breaks the line, leaving the typed text).
 */

export type SlashMenuHandle = { onKeyDown: (event: KeyboardEvent) => boolean };

export const SlashMenu = forwardRef<SlashMenuHandle, SuggestionProps<SlashItem>>(function SlashMenu({ items, command }, ref) {
  const [index, setIndex] = useState(0);
  // A new result list starts at its first item (derived during render, like the other pickers).
  const signature = items.map((i) => i.id).join(",");
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setIndex(0);
  }
  const safeIndex = Math.min(index, Math.max(items.length - 1, 0));

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown(event) {
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setIndex((safeIndex + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setIndex((safeIndex - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          command(items[safeIndex]);
          return true;
        }
        return false;
      },
    }),
    [items, safeIndex, command],
  );

  return <SlashMenuList items={items} selectedIndex={safeIndex} onSelect={(i) => command(items[i])} onHover={setIndex} />;
});
