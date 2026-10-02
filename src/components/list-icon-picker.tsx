"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LIST_ICON_KEYS } from "@/lib/list-icons";
import { ListIcon, LIST_ICON_COMPONENTS } from "@/components/list-icon";

/** The 6-column icon grid; used by ListIconPicker and by the list header's controlled popover. */
export function ListIconGrid({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (icon: string | null) => void;
}) {
  const current = value ?? "list";
  return (
    <div className="grid w-fit grid-cols-6 gap-0.5">
      {LIST_ICON_KEYS.map((key) => {
        const Glyph = LIST_ICON_COMPONENTS[key];
        const selected = key === current;
        return (
          <button
            key={key}
            type="button"
            aria-label={key}
            title={key}
            onClick={() => onSelect(key === "list" ? null : key)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted",
              selected && "bg-selected text-selected-foreground hover:bg-selected",
            )}
          >
            <Glyph className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

export function ListIconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (icon: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="List icon"
            className="shrink-0 text-muted-foreground"
          />
        }
      >
        <ListIcon icon={value} className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-fit">
        <ListIconGrid
          value={value}
          onSelect={(icon) => {
            onChange(icon);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
