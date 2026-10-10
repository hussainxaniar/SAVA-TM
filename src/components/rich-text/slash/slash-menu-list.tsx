"use client";

import { useEffect, useRef } from "react";
import {
  IconBlockquote,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconPhoto,
  IconSeparatorHorizontal,
  IconSquareCheck,
  IconSubtask,
  IconTypography,
} from "@tabler/icons-react";
import { cn } from "cn";
import { groupSlashItems, type SlashIconKey, type SlashItem } from "@/lib/slash-items";

const ICONS: Record<SlashIconKey, typeof IconTypography> = {
  text: IconTypography,
  h1: IconH1,
  h2: IconH2,
  h3: IconH3,
  bullet: IconList,
  numbered: IconListNumbers,
  todo: IconSquareCheck,
  quote: IconBlockquote,
  code: IconCode,
  divider: IconSeparatorHorizontal,
  image: IconPhoto,
  task: IconSubtask,
};

/**
 * The list of the "/" menu (11.5): grouped `items` with an icon, title and hint per row. The
 * container (popup background, border, shadow, max-h and scrolling) comes from the extension's
 * menu; this renders only the list content. `selectedIndex` indexes the flat `items` array.
 */
export function SlashMenuList({
  items,
  selectedIndex,
  onSelect,
  onHover,
}: {
  items: SlashItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
}) {
  const groups = groupSlashItems(items);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div ref={listRef} role="listbox" aria-label="Insert a block" className="flex w-72 flex-col">
      {items.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">No results</p>
      ) : (
        groups.map(({ group, items: groupItems }) => (
          <div key={group} role="group" aria-label={group} className="flex flex-col">
            <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">{group}</p>
            {groupItems.map((item) => {
              const index = items.indexOf(item);
              const selected = index === selectedIndex;
              const Icon = ICONS[item.icon];
              return (
                <button
                  key={item.id}
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => {
                    if (!selected) onHover(index);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(index)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm",
                    selected && "bg-accent text-accent-foreground"
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="min-w-0 grow truncate">{item.title}</span>
                  {item.hint && (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.hint}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}