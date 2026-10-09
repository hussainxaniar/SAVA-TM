"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { comparePositions, positionBetween } from "@/lib/position";
import {
  createPageAction,
  deletePageAction,
  getPageAction,
  getPageTreeAction,
  movePageAction,
  renameDocAction,
  savePageAction,
} from "@/server/actions/docs";
import type { DocPageDTO, PageTreeNodeDTO } from "@/server/services/types";
import { unwrap } from "./use-list-view";

/*
 * The doc view's data (T-20, Sections 8.7 / 11). Keys: ['doc', docId, 'tree'] for the page tree and
 * ['doc', docId, 'page', pageId] for a page. Tree edits are optimistic and roll back with a toast.
 * Page *saving* is not a mutation hook: the editor calls savePageAction itself (autosave, the
 * conflict banner and Overwrite need its exact result), see use-page-autosave.ts.
 */

export const treeKey = (docId: string) => ["doc", docId, "tree"] as const;
export const pageKey = (docId: string, pageId: string) => ["doc", docId, "page", pageId] as const;

export function usePageTree(docId: string, initialData: PageTreeNodeDTO[]) {
  return useQuery({
    queryKey: treeKey(docId),
    queryFn: async () => unwrap(await getPageTreeAction({ docId })),
    initialData,
  });
}

/** A page. `initialData` is the server-rendered page for the first paint. */
export function usePage(docId: string, pageId: string, initialData?: DocPageDTO) {
  return useQuery({
    queryKey: pageKey(docId, pageId),
    queryFn: async () => unwrap(await getPageAction({ pageId })),
    initialData,
  });
}

/** "+" on a page row, or "Add page". Returns the new page's id (mutateAsync) so the UI can open it. */
export function useCreatePage(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { parentId: string | null; title?: string }) =>
      unwrap(await createPageAction({ docId, parentId: v.parentId, title: v.title })),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong. Try again."),
    onSettled: () => void qc.invalidateQueries({ queryKey: treeKey(docId) }),
  });
}

/** Drag to reorder / re-nest (use projectDrop from src/lib/page-tree.ts for the arguments). */
export function useMovePage(docId: string) {
  const qc = useQueryClient();
  const key = treeKey(docId);
  return useMutation({
    mutationFn: async (v: { pageId: string; parentId: string | null; beforeId: string | null; afterId: string | null }) =>
      unwrap(await movePageAction(v)),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PageTreeNodeDTO[]>(key);
      if (prev) {
        const sibs = prev
          .filter((p) => p.parentId === v.parentId && p.id !== v.pageId)
          .sort((x, y) => comparePositions(x.position, y.position));
        const at = (id: string | null) => (id ? sibs.findIndex((p) => p.id === id) : -1);
        // Between the neighbours the drop named (afterId wins, as on the server); neither = last.
        const i = v.afterId ? at(v.afterId) : at(v.beforeId);
        let above: string | null;
        let below: string | null;
        if (v.afterId && i >= 0) [above, below] = [sibs[i - 1]?.position ?? null, sibs[i].position];
        else if (v.beforeId && i >= 0) [above, below] = [sibs[i].position, sibs[i + 1]?.position ?? null];
        else [above, below] = [sibs.at(-1)?.position ?? null, null];
        let position = prev.find((p) => p.id === v.pageId)?.position ?? "a0";
        try {
          position = positionBetween(above, below);
        } catch {
          // neighbours out of order locally; the server decides
        }
        qc.setQueryData<PageTreeNodeDTO[]>(key, prev.map((p) => (p.id === v.pageId ? { ...p, parentId: v.parentId, position } : p)));
      }
      return { prev };
    },
    onError: (error, _v, context) => {
      if (context?.prev) qc.setQueryData(key, context.prev);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

/** Delete a page and its children (the caller confirms first and navigates away). */
export function useDeletePage(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { pageId: string }) => unwrap(await deletePageAction(v)),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong. Try again."),
    onSettled: () => void qc.invalidateQueries({ queryKey: treeKey(docId) }),
  });
}

/**
 * Renames the doc itself (not a page): the doc header's title and the sidebar entry. The action
 * refresh()es the server-rendered header and the sidebar, so there is no cache to patch; callers that
 * want an instant title keep a local value (see doc-title.tsx) and this rolls back with a toast.
 */
export function useRenameDoc(docId: string) {
  return useMutation({
    mutationFn: async (v: { title: string }) => unwrap(await renameDocAction({ docId, title: v.title })),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong. Try again."),
  });
}

/** Retitle in the tree right away when a page's title is saved (the tree row shows it). */
export function useSetTreeTitle(docId: string) {
  const qc = useQueryClient();
  return (pageId: string, title: string) =>
    qc.setQueryData<PageTreeNodeDTO[]>(treeKey(docId), (tree) => tree?.map((p) => (p.id === pageId ? { ...p, title } : p)));
}

export { savePageAction };
