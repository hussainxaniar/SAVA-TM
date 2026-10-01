"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createTimeBlockAction,
  deleteTimeBlockAction,
  listDueChipsAction,
  listTimeBlocksAction,
  listUnscheduledAction,
  retrySyncAction,
  updateTimeBlockAction,
} from "@/server/actions/timeblocks";
import { getGoogleConnectionAction } from "@/server/actions/google";
import type { MyTaskDTO, TimeBlockDTO } from "@/server/services/types";
import { taskKey, unwrap } from "./use-list-view";

/*
 * Calendar data (T-17, Sections 8.6 / 10.1). Keys live under ['calendar', spaceId]:
 *   [..., 'blocks', start, end] my time blocks in the visible range
 *   [..., 'due', start, end]    all-day due chips in the visible range
 *   [..., 'unscheduled', projectId | 'all'] the left rail
 * Block writes are optimistic across every cached range, send the browser's time zone, and
 * refresh the rail and the task's dialog (its Scheduled section and feed) when they land.
 */

export type Range = { start: string; end: string };

export const calendarKey = (spaceId: string) => ["calendar", spaceId] as const;
const blocksKey = (spaceId: string, r: Range) => [...calendarKey(spaceId), "blocks", r.start, r.end] as const;
const dueKey = (spaceId: string, r: Range) => [...calendarKey(spaceId), "due", r.start, r.end] as const;
const unscheduledKey = (spaceId: string, projectId: string | null) =>
  [...calendarKey(spaceId), "unscheduled", projectId ?? "all"] as const;

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function useTimeBlocks(spaceId: string, range: Range | null) {
  return useQuery({
    queryKey: range ? blocksKey(spaceId, range) : [...calendarKey(spaceId), "blocks", "none"],
    queryFn: async () => unwrap(await listTimeBlocksAction({ spaceId, rangeStart: range!.start, rangeEnd: range!.end })),
    enabled: !!range,
    placeholderData: keepPreviousData,
  });
}

export function useDueChips(spaceId: string, range: Range | null) {
  return useQuery({
    queryKey: range ? dueKey(spaceId, range) : [...calendarKey(spaceId), "due", "none"],
    queryFn: async () => unwrap(await listDueChipsAction({ spaceId, rangeStart: range!.start, rangeEnd: range!.end })),
    enabled: !!range,
    placeholderData: keepPreviousData,
  });
}

export function useUnscheduled(spaceId: string, projectId: string | null) {
  return useQuery({
    queryKey: unscheduledKey(spaceId, projectId),
    queryFn: async () => unwrap(await listUnscheduledAction({ spaceId, projectId })),
  });
}

type Snapshot = [QueryKey, unknown][];

function useBlockMutation<V extends { taskId: string }, R>(
  spaceId: string,
  run: (v: V) => Promise<R>,
  patch: (blocks: TimeBlockDTO[], v: V) => TimeBlockDTO[],
  opts: { leavesRail?: (v: V) => boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: calendarKey(spaceId) });
      const snapshot: Snapshot = [];
      for (const [key, data] of qc.getQueriesData<TimeBlockDTO[]>({ queryKey: [...calendarKey(spaceId), "blocks"] })) {
        if (!data) continue;
        snapshot.push([key, data]);
        qc.setQueryData(key, patch(data, v));
      }
      if (opts.leavesRail?.(v)) {
        for (const [key, data] of qc.getQueriesData<MyTaskDTO[]>({ queryKey: [...calendarKey(spaceId), "unscheduled"] })) {
          if (!data) continue;
          snapshot.push([key, data]);
          qc.setQueryData(key, data.filter((t) => t.id !== v.taskId));
        }
      }
      return { snapshot };
    },
    onError: (error, _v, context) => {
      for (const [key, data] of context?.snapshot ?? []) qc.setQueryData(key, data);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: (_r, _e, v) => {
      void qc.invalidateQueries({ queryKey: calendarKey(spaceId) });
      void qc.invalidateQueries({ queryKey: taskKey(v.taskId) }); // dialog: Scheduled section + feed
    },
  });
}

/**
 * Drop a task on the grid, or "+" in the dialog's Scheduled section. Pass the task's title and
 * project color so the temporary block (id "temp-…") renders like the real one.
 */
export function useCreateTimeBlock(spaceId: string) {
  return useBlockMutation(
    spaceId,
    async (v: { taskId: string; taskTitle: string; projectColor: string; start: string; end: string; tempId: string }) =>
      unwrap(await createTimeBlockAction({ taskId: v.taskId, start: v.start, end: v.end, timeZone: browserTimeZone() })),
    (blocks, v) => [
      ...blocks,
      {
        id: v.tempId,
        taskId: v.taskId,
        taskTitle: v.taskTitle,
        projectColor: v.projectColor,
        completed: false,
        start: v.start,
        end: v.end,
        syncState: "PENDING",
        lastSyncError: null,
      },
    ],
    { leavesRail: (v) => new Date(v.end).getTime() > Date.now() },
  );
}

/** Drag to move, resize to change the duration (15-minute snap in the grid). */
export function useUpdateTimeBlock(spaceId: string) {
  return useBlockMutation(
    spaceId,
    async (v: { timeBlockId: string; taskId: string; start: string; end: string }) =>
      unwrap(await updateTimeBlockAction({ timeBlockId: v.timeBlockId, start: v.start, end: v.end, timeZone: browserTimeZone() })),
    (blocks, v) => blocks.map((b) => (b.id === v.timeBlockId ? { ...b, start: v.start, end: v.end } : b)),
  );
}

/** "Remove from calendar" (block popover) and the dialog's Scheduled ×. */
export function useDeleteTimeBlock(spaceId: string) {
  return useBlockMutation(
    spaceId,
    async (v: { timeBlockId: string; taskId: string }) => unwrap(await deleteTimeBlockAction({ timeBlockId: v.timeBlockId })),
    (blocks, v) => blocks.filter((b) => b.id !== v.timeBlockId),
  );
}

// ---------- Google Calendar (T-18) ----------

export const googleConnectionKey = ["google-connection"] as const;

/** Whether my Google Calendar is connected (sync icons only show when it is). */
export function useGoogleConnection() {
  return useQuery({
    queryKey: googleConnectionKey,
    queryFn: async () => unwrap(await getGoogleConnectionAction({})),
    staleTime: 60_000,
  });
}

/** An ERROR block's Retry: push it to Google again; the calendar and the task's dialog re-sync. */
export function useRetrySync(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { timeBlockId: string; taskId: string }) =>
      unwrap(await retrySyncAction({ timeBlockId: v.timeBlockId, timeZone: browserTimeZone() })),
    onSuccess: (block) => {
      if (block.syncState === "ERROR") toast.error(block.lastSyncError ?? "Google Calendar sync failed again.");
      else toast.success("Synced to Google Calendar");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong. Try again."),
    onSettled: (_r, _e, v) => {
      void qc.invalidateQueries({ queryKey: calendarKey(spaceId) });
      void qc.invalidateQueries({ queryKey: taskKey(v.taskId) });
      void qc.invalidateQueries({ queryKey: googleConnectionKey }); // a failed refresh may have disconnected
    },
  });
}
