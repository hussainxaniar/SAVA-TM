"use client";

import { useState } from "react";
import { IconExternalLink, IconRefresh, IconTrash } from "@tabler/icons-react";
import type { BlockTap } from "@/components/calendar/calendar-grid";
import { BottomSheet, BottomSheetOption } from "@/components/ui/bottom-sheet";
import { useDeleteTimeBlock, useGoogleConnection, useRetrySync } from "@/hooks/use-calendar";
import { cn } from "@/lib/utils";

/*
 * The block detail sheet (docs/design/mobile/05-calendar-schedule-flow #4), opened by tapping
 * one of my blocks on the phone grid: the task title and slot, the Google sync state when
 * connected, and the options to open the task or remove the block again.
 */

function dateLine(block: BlockTap) {
  const date = block.start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const from = block.start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const to = block.end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${date} · ${from}–${to}`;
}

export function CalendarBlockSheet({
  spaceId,
  block,
  onClose,
  onOpenTask,
}: {
  spaceId: string;
  block: BlockTap | null;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  // The last non-null block: the sheet keeps its content while it slides closed. Adjusted
  // during render (react.dev/learn/you-might-not-need-an-effect) so it never lags a reopen.
  const [shown, setShown] = useState<BlockTap | null>(block);
  if (block && block !== shown) setShown(block);

  const connected = useGoogleConnection().data?.connected;
  const deleteTimeBlock = useDeleteTimeBlock(spaceId);
  const retrySync = useRetrySync(spaceId);

  return (
    <BottomSheet label="Time block" open={block !== null} onOpenChange={(open) => !open && onClose()}>
      {shown && (
        <>
          <div className="flex flex-col gap-1 px-4 pb-3 pt-1">
            <div
              className={cn(
                "text-lg font-semibold leading-[26px] text-foreground",
                shown.completed && "line-through text-muted-foreground",
              )}
            >
              {shown.title}
            </div>
            <div className="text-sm text-body">{dateLine(shown)}</div>
          </div>
          {connected && (
            <div className="flex h-9 items-center gap-2 border-y border-divider bg-panel px-4 text-[13px] text-muted-foreground">
              <IconRefresh
                aria-hidden
                className={cn(
                  "size-4 shrink-0",
                  shown.syncState === "SYNCED" && "text-success",
                  shown.syncState === "ERROR" && "text-overdue",
                )}
              />
              {shown.syncState === "SYNCED" && <span>Synced to Google Calendar</span>}
              {shown.syncState === "PENDING" && <span>Waiting to sync</span>}
              {shown.syncState === "ERROR" && (
                <>
                  <span>Couldn&apos;t sync</span>
                  <button
                    type="button"
                    className="ml-auto font-medium text-primary"
                    onClick={() => retrySync.mutate({ timeBlockId: shown.timeBlockId, taskId: shown.taskId })}
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          )}
          <BottomSheetOption
            icon={<IconExternalLink className="size-[22px] text-icon" stroke={1.8} />}
            onClick={() => {
              onClose();
              onOpenTask(shown.taskId);
            }}
          >
            Open task
          </BottomSheetOption>
          <BottomSheetOption
            destructive
            icon={<IconTrash className="size-[22px] text-overdue" stroke={1.8} />}
            onClick={() => {
              deleteTimeBlock.mutate({ timeBlockId: shown.timeBlockId, taskId: shown.taskId });
              onClose();
            }}
          >
            Remove from calendar
          </BottomSheetOption>
        </>
      )}
    </BottomSheet>
  );
}