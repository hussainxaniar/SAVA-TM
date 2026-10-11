"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPencil, IconProgress } from "@tabler/icons-react";
import {
  BottomSheet,
  BottomSheetAction,
  BottomSheetOption,
} from "@/components/ui/bottom-sheet";
import { useRenameList, useSetSubtaskDisplay } from "@/hooks/use-list-view";
import { cn } from "@/lib/utils";
import type { ListViewDTO } from "@/server/services/types";

/*
 * The list menu sheet (docs/design/mobile/11-shared "List menu sheet"): the view options
 * (subtasks Nested / Separate, show completed), rename, and a link to the project's statuses.
 */
export function ListMenuSheet({
  open,
  onOpenChange,
  data,
  spaceId,
  showCompleted,
  onShowCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ListViewDTO;
  spaceId: string;
  showCompleted: boolean;
  onShowCompleted: (value: boolean) => void;
}) {
  const router = useRouter();
  const listId = data.list.id;
  const setSubtaskDisplay = useSetSubtaskDisplay(listId);
  const renameList = useRenameList(listId);

  // "menu" shows the options; "rename" swaps the body for the name field until the sheet closes.
  const [stage, setStage] = useState<"menu" | "rename">("menu");
  const [name, setName] = useState(data.list.name);

  const close = (open: boolean) => {
    if (!open) setStage("menu");
    onOpenChange(open);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed !== data.list.name) renameList.mutate({ name: trimmed });
    close(false);
  };

  const subtaskDisplay = data.list.subtaskDisplay;

  return (
    <BottomSheet
      open={open}
      onOpenChange={close}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: data.project.color }}
          />
          <span className="truncate">{data.list.name}</span>
        </span>
      }
      action={
        stage === "rename" ? (
          <BottomSheetAction disabled={!name.trim()} onClick={save}>
            Save
          </BottomSheetAction>
        ) : undefined
      }
    >
      {stage === "rename" ? (
        <div className="px-4 py-2">
          <input
            autoFocus
            aria-label="List name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className="h-11 w-full rounded-[10px] bg-pill px-3 text-base outline-none"
          />
        </div>
      ) : (
        <>
          <div className="flex h-14 items-center px-4 text-base">
            <span className="min-w-0 flex-1">Subtasks</span>
            <div className="flex rounded-lg bg-pill p-0.5">
              <button
                type="button"
                aria-pressed={subtaskDisplay === "NESTED"}
                onClick={() => setSubtaskDisplay.mutate({ subtaskDisplay: "NESTED" })}
                className={cn(
                  "h-8 rounded-md px-3 text-[13px] font-medium",
                  subtaskDisplay === "NESTED"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Nested
              </button>
              <button
                type="button"
                aria-pressed={subtaskDisplay === "SEPARATE"}
                onClick={() => setSubtaskDisplay.mutate({ subtaskDisplay: "SEPARATE" })}
                className={cn(
                  "h-8 rounded-md px-3 text-[13px] font-medium",
                  subtaskDisplay === "SEPARATE"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Separate
              </button>
            </div>
          </div>
          <div className="flex h-14 items-center px-4 text-base">
            <span className="min-w-0 flex-1">Show completed tasks</span>
            <button
              type="button"
              role="switch"
              aria-checked={showCompleted}
              onClick={() => onShowCompleted(!showCompleted)}
              className={cn(
                "flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors",
                showCompleted ? "bg-primary" : "bg-input",
              )}
            >
              <span
                className={cn(
                  "size-6 rounded-full bg-white transition-transform",
                  showCompleted && "translate-x-5",
                )}
              />
            </button>
          </div>
          <div className="border-t border-divider" />
          <BottomSheetOption
            icon={<IconPencil className="size-[22px] text-icon" stroke={1.8} />}
            onClick={() => {
              setName(data.list.name);
              setStage("rename");
            }}
          >
            Rename list
          </BottomSheetOption>
          <BottomSheetOption
            icon={<IconProgress className="size-[22px] text-icon" stroke={1.8} />}
            onClick={() => router.push(`/s/${spaceId}/p/${data.project.id}/settings`)}
          >
            Project statuses
          </BottomSheetOption>
        </>
      )}
    </BottomSheet>
  );
}