"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Content, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

/**
 * The dialog's description editor (9.4.3): Tiptap with a "Description" placeholder, autosaving
 * 800 ms after the last keystroke and flushing immediately on blur and unmount (closing the
 * dialog or stepping to another task — the parent keys this by task id so remounting flushes).
 * Skips the save when the JSON equals the last saved one. Description-only saves never refetch
 * the task (see useEditTask), so the editor is the source of truth while it's open.
 */
export function DescriptionEditor({
  description,
  onSave,
}: {
  /** Tiptap JSON from getTask; null when empty. */
  description: unknown;
  onSave: (description: { type: "doc"; [key: string]: unknown } | null) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Description" }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: (description ?? "") as Content,
    immediatelyRender: false,
    editorProps: { attributes: { class: "rich-text min-h-[22px]" } },
  });

  // Pending (debounced) save, and the JSON string last handed to onSave. Keyed per task by the
  // parent, so the mount-time description is the saved baseline; it only changes via onSave.
  // `undefined` = nothing pending; `null` = the user emptied the description (a save of null).
  const pendingRef = useRef<JSONContent | null | undefined>(undefined);
  const savedRef = useRef<string | null>(description === null ? null : JSON.stringify(description));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {});
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  });

  useEffect(() => {
    if (!editor) return;
    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const pending = pendingRef.current;
      pendingRef.current = undefined;
      if (pending === undefined) return;
      const json = pending === null ? null : JSON.stringify(pending);
      if (json === savedRef.current) return;
      savedRef.current = json;
      saveRef.current(pending as { type: "doc"; [key: string]: unknown } | null);
    };
    flushRef.current = flush;
    const onEditorUpdate = () => {
      pendingRef.current = editor.isEmpty ? null : editor.getJSON();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flush();
      }, 800);
    };
    editor.on("update", onEditorUpdate);
    return () => {
      editor.off("update", onEditorUpdate);
      flush(); // closing or stepping to another task: save what was typed
    };
  }, [editor]);

  return (
    <div className="min-w-0 flex-1" onBlur={() => flushRef.current()}>
      <EditorContent editor={editor} />
    </div>
  );
}
