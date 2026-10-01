"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { UserLite } from "@/server/services/types";
import { TaskDialog } from "./task-dialog";

export type TaskDialogHostProps = {
  spaceId: string;
  /** Current space members (the Assignees picker, 6.8). */
  members: UserLite[];
  /** The signed-in user (the comment composer's avatar, optimistic comments). */
  me: UserLite;
};

/**
 * T-11: renders the task dialog while the URL has `?task=<id>`, on any page of the space
 * (Section 9.4). The id lives in the URL, so reload keeps the dialog open and tasks are
 * linkable; closing (Esc, ×, click outside) just drops the param.
 */
export function TaskDialogHost({ spaceId, members, me }: TaskDialogHostProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");

  const buildUrl = useCallback(
    (task: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (task) params.set("task", task);
      else params.delete("task");
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams],
  );

  const close = useCallback(
    () => router.replace(buildUrl(null), { scroll: false }),
    [router, buildUrl],
  );

  /** Opening another task (breadcrumb ancestor, subtask, ↑/↓) keeps the rest of the URL. */
  const openTask = useCallback(
    (id: string) => router.replace(buildUrl(id), { scroll: false }),
    [router, buildUrl],
  );

  return (
    <TaskDialog
      spaceId={spaceId}
      members={members}
      me={me}
      taskId={taskId}
      open={taskId !== null}
      onClose={close}
      onOpenTask={openTask}
    />
  );
}
