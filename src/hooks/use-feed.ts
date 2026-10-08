"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addCommentAction, deleteCommentAction, editCommentAction, getFeedAction } from "@/server/actions/comments";
import type { FeedItemDTO, UserLite } from "@/server/services/types";
import { unwrap } from "./use-list-view";

/*
 * The task dialog's Activity section (T-15, Section 8.5). One query per task holds comments and
 * activity (oldest first); the All / Comments toggle filters on the client. The key sits under
 * ['task', taskId], so every task edit that invalidates the task also refreshes its feed.
 * Comment mutations are optimistic and roll back with an error toast.
 */

export const feedKey = (taskId: string) => ["task", taskId, "feed"] as const;

export type Body = { type: "doc"; [key: string]: unknown };

export function useFeed(taskId: string | null) {
  return useQuery({
    queryKey: feedKey(taskId ?? ""),
    queryFn: async () => unwrap(await getFeedAction({ taskId: taskId! })),
    enabled: !!taskId,
  });
}

/** Posts a comment; a temporary entry ("temp-…") shows at once and is replaced by the server's. */
export function useAddComment(taskId: string, me: UserLite) {
  const qc = useQueryClient();
  const key = feedKey(taskId);
  return useMutation({
    mutationFn: async (v: { body: Body; tempId: string }) => unwrap(await addCommentAction({ taskId, body: v.body })),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FeedItemDTO[]>(key);
      const temp: FeedItemDTO = {
        kind: "comment",
        id: v.tempId,
        author: me,
        body: v.body,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deleted: false,
        via: null,
        canEdit: false,
        canDelete: false,
      };
      qc.setQueryData<FeedItemDTO[]>(key, [...(prev ?? []), temp]);
      return { prev };
    },
    onError: (error, _v, context) => {
      qc.setQueryData(key, context?.prev);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSuccess: (item, v) => {
      qc.setQueryData<FeedItemDTO[]>(key, (items) => items?.map((i) => (i.id === v.tempId ? item : i)));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

/** Author only (the server checks). */
export function useEditComment(taskId: string) {
  const qc = useQueryClient();
  const key = feedKey(taskId);
  return useMutation({
    mutationFn: async (v: { commentId: string; body: Body }) => unwrap(await editCommentAction(v)),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FeedItemDTO[]>(key);
      qc.setQueryData<FeedItemDTO[]>(key, (items) =>
        items?.map((i) =>
          i.kind === "comment" && i.id === v.commentId ? { ...i, body: v.body, editedAt: new Date().toISOString() } : i,
        ),
      );
      return { prev };
    },
    onError: (error, _v, context) => {
      qc.setQueryData(key, context?.prev);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

/** Soft delete: the entry becomes "Comment deleted". Author or Admin/Owner (the server checks). */
export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  const key = feedKey(taskId);
  return useMutation({
    mutationFn: async (v: { commentId: string }) => unwrap(await deleteCommentAction(v)),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FeedItemDTO[]>(key);
      qc.setQueryData<FeedItemDTO[]>(key, (items) =>
        items?.map((i) =>
          i.kind === "comment" && i.id === v.commentId
            ? { ...i, deleted: true, body: null, canEdit: false, canDelete: false }
            : i,
        ),
      );
      return { prev };
    },
    onError: (error, _v, context) => {
      qc.setQueryData(key, context?.prev);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}
