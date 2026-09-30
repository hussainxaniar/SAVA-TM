"use client";

import { ListFilter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { DisplayMode, SortMode } from "@/lib/list-view";

/** The "View" button's menu: subtask display (shared), sort and show-completed. */
export function ViewMenu({
  mode,
  sort,
  showCompleted,
  onMode,
  onSort,
  onShowCompleted,
}: {
  mode: DisplayMode;
  sort: SortMode;
  showCompleted: boolean;
  onMode: (mode: DisplayMode) => void;
  onSort: (sort: SortMode) => void;
  onShowCompleted: (show: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            aria-label="View options"
            className="h-[30px] shrink-0 gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-foreground/80 hover:bg-sidebar"
          />
        }
      >
        <ListFilter className="size-4 text-muted-foreground" />
        View
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Subtasks</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={mode} onValueChange={(v) => onMode(v as DisplayMode)}>
            <DropdownMenuRadioItem value="NESTED">Nested</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="SEPARATE">Separate</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <p className="px-1.5 py-1 text-xs text-muted-foreground">Everyone sees this</p>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSort(v as SortMode)}>
            <DropdownMenuRadioItem value="manual">Manual</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="due">Due date</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={showCompleted}
            onCheckedChange={(checked) => onShowCompleted(Boolean(checked))}
          >
            Show completed
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
