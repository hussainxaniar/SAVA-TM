"use client";

import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { SlashItem } from "@/lib/slash-items";
import { cn } from "@/lib/utils";
import { ICONS } from "./slash-menu-list";

/*
 * The phone's "/" menu (M-07, docs/design/mobile/09): not a popup at the caret but a fixed bar of
 * pills pinned to the bottom of the screen, above the on-screen keyboard (useKeyboardInset). A tap
 * applies the pill; onMouseDown is prevented so the editor keeps the focus and the keyboard stays up.
 */

export function SlashBar({
  items,
  selectedIndex,
  onSelect,
}: {
  items: SlashItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const keyboardInset = useKeyboardInset();
  if (items.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Insert block"
      className="fixed inset-x-0 z-50 flex h-[52px] items-center gap-2 overflow-x-auto border-t border-border bg-background px-3"
      style={{ bottom: keyboardInset }}
    >
      {items.map((item, index) => {
        const selected = index === selectedIndex;
        const Icon = ICONS[item.icon];
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={selected}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(index)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
              selected ? "bg-selected text-selected-foreground" : "bg-pill text-foreground",
            )}
          >
            <Icon aria-hidden className="size-[18px]" />
            {item.title}
          </button>
        );
      })}
    </div>
  );
}