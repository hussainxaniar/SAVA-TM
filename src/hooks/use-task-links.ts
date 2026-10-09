"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { getTaskLabelsAction, searchTasksAction } from "@/server/actions/task-links";
import { unwrap } from "./use-list-view";

/*
 * Task links in docs (Section 11.4). A chip asks for its task's live label (title, status, done); a
 * missing result means the task was deleted or is not readable, and the chip says so. The insert
 * popover searches the space's tasks by title. Both read the space id from the route.
 */

const labelKey = (spaceId: string, taskId: string) => ["task-label", spaceId, taskId] as const;

/** The space id of the current route (the editor sits under /s/[spaceId]). */
function useRouteSpaceId(): string | null {
  const params = useParams<{ spaceId?: string }>();
  return params?.spaceId ?? null;
}

/** `undefined` while loading, `null` when the task cannot be shown (deleted or foreign), else its label. */
export function useTaskLabel(taskId: string) {
  const spaceId = useRouteSpaceId();
  return useQuery({
    queryKey: labelKey(spaceId ?? "", taskId),
    enabled: !!spaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const labels = unwrap(await getTaskLabelsAction({ spaceId: spaceId!, taskIds: [taskId] }));
      return labels[0] ?? null;
    },
  });
}

/** Tasks matching the typed text (empty text lists the most recently changed); only runs while `enabled`. */
export function useTaskSearch(query: string, enabled: boolean) {
  const spaceId = useRouteSpaceId();
  return useQuery({
    queryKey: ["task-search", spaceId ?? "", query.trim().toLowerCase()],
    enabled: enabled && !!spaceId,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    queryFn: async () => unwrap(await searchTasksAction({ spaceId: spaceId!, query })),
  });
}
