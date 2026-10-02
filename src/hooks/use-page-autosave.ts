"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPageAction, savePageAction } from "@/server/actions/docs";
import type { DocPageDTO, UserLite } from "@/server/services/types";
import { pageKey, treeKey } from "./use-doc";

/*
 * Autosave for one doc page (Section 11.2). The editor calls `change()` on every edit; this hook
 * debounces 800 ms, sends one save at a time with `baseUpdatedAt` = the version it last loaded or
 * saved, and handles the three outcomes:
 *   saved    → the base moves to the new version;
 *   conflict → someone else saved first: nothing was written, autosave pauses and `conflict` is set
 *              (show the banner; `reload()` takes their version, `overwrite()` resends over it);
 *   error    → toast, and the next edit tries again.
 * `flush()` saves right now (blur, leaving the page); it also runs when the component unmounts and
 * when the tab is hidden. Closing the tab while changes are unsaved asks for confirmation.
 */

export type SaveStatus = "saved" | "dirty" | "saving" | "conflict" | "error";
export type Conflict = { updatedBy: UserLite; updatedAt: string };
type Pending = { title?: string; content?: DocPageDTO["content"] };

const DEBOUNCE_MS = 800;

export function usePageAutosave(opts: { docId: string; page: DocPageDTO; me: UserLite }) {
  const { docId, page, me } = opts;
  const qc = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [conflict, setConflict] = useState<Conflict | null>(null);
  /** Bumps when `reload()` replaces the page with the server's version: key the editor on it. */
  const [version, setVersion] = useState(0);

  const base = useRef(page.updatedAt);
  const pending = useRef<Pending | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paused = useRef(false); // true while a conflict is unresolved
  const statusRef = useRef<SaveStatus>("saved");
  const set = (s: SaveStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  // `send` calls itself again for edits made while saving; through a ref so the hook can reference it.
  const sendRef = useRef<(baseOverride?: string) => Promise<void>>(async () => {});

  const patchCache = useCallback(
    (patch: Pending, updatedAt: string) => {
      qc.setQueryData<DocPageDTO>(pageKey(docId, page.id), (p) =>
        p ? { ...p, ...patch, updatedAt, updatedBy: me } : p,
      );
      if (patch.title !== undefined) {
        qc.setQueryData<{ id: string; title: string }[]>(treeKey(docId), (tree) =>
          tree?.map((n) => (n.id === page.id ? { ...n, title: patch.title! } : n)),
        );
      }
    },
    [qc, docId, page.id, me],
  );

  const send = useCallback(
    async (baseOverride?: string) => {
      if (inFlight.current || paused.current) return;
      const batch = pending.current;
      if (!batch) return;
      pending.current = null;
      inFlight.current = true;
      set("saving");
      try {
        const res = await savePageAction({
          pageId: page.id,
          title: batch.title,
          content: batch.content as { type: "doc" } | undefined,
          baseUpdatedAt: baseOverride ?? base.current,
        });
        if (!res.ok) {
          // Keep the edits for the next try; a newer edit made meanwhile wins per field.
          pending.current = { ...batch, ...(pending.current ?? {}) };
          set("error");
          toast.error(res.error.message);
        } else if (res.data.conflict) {
          pending.current = { ...batch, ...(pending.current ?? {}) };
          paused.current = true;
          setConflict({ updatedBy: res.data.updatedBy, updatedAt: res.data.updatedAt });
          set("conflict");
        } else {
          base.current = res.data.updatedAt;
          patchCache(batch, res.data.updatedAt);
          set(pending.current ? "dirty" : "saved");
        }
      } catch (e) {
        pending.current = { ...batch, ...(pending.current ?? {}) };
        set("error");
        console.error(e);
      } finally {
        inFlight.current = false;
      }
      // Edits that arrived while saving go out right away.
      if (pending.current && !paused.current && statusRef.current !== "error") void sendRef.current();
    },
    [page.id, patchCache],
  );
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await send();
  }, [send]);

  /** Record an edit (title and/or full content JSON) and schedule the debounced save. */
  const change = useCallback(
    (edit: Pending) => {
      pending.current = { ...pending.current, ...edit };
      if (!paused.current) set(inFlight.current ? "saving" : "dirty");
      if (paused.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void send(), DEBOUNCE_MS);
    },
    [send],
  );

  /** Conflict banner → Overwrite: resend my edits over their version. */
  const overwrite = useCallback(async () => {
    if (!conflict) return;
    const over = conflict.updatedAt;
    paused.current = false;
    setConflict(null);
    await send(over);
  }, [conflict, send]);

  /** Conflict banner → Reload: drop my edits and take the server's page (the editor remounts on `version`). */
  const reload = useCallback(async () => {
    const res = await getPageAction({ pageId: page.id });
    if (!res.ok) return void toast.error(res.error.message);
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    paused.current = false;
    base.current = res.data.updatedAt;
    qc.setQueryData(pageKey(docId, page.id), res.data);
    qc.setQueryData<{ id: string; title: string }[]>(treeKey(docId), (tree) =>
      tree?.map((n) => (n.id === page.id ? { ...n, title: res.data.title } : n)),
    );
    setConflict(null);
    set("saved");
    setVersion((v) => v + 1);
  }, [qc, docId, page.id]);

  // Leaving the page, hiding the tab or closing it: save what's pending.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (pending.current || inFlight.current || paused.current) {
        void flush();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, [flush]);

  return { status, conflict, version, change, flush, overwrite, reload };
}
