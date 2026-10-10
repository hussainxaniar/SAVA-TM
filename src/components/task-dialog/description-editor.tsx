"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Content, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { PageToolbar } from "@/components/docs/page-toolbar";
import { SlashCommand } from "@/components/rich-text/slash/slash-command";
import { imageEditorProps } from "@/components/rich-text/image-handlers";
import { imageExtensions } from "@/components/rich-text/resizable-image";

/**
 * The dialog's description editor (9.4.3): Tiptap with the selection toolbar, checklists and
 * images (I-02), a "Description" placeholder, autosaving 800 ms after the last keystroke and
 * flushing immediately on blur and unmount (closing the dialog or stepping to another task —
 * the parent keys this by task id so remounting flushes). Skips the save when the JSON equals
 * the last saved one. Description-only saves never refetch the task (see useEditTask), so the
 * editor is the source of truth while it's open. Ctrl/Cmd+click on a link opens it in a new
 * tab (plain clicks keep editing the text).
 */
export function DescriptionEditor({
  description,
  spaceId,
  onSave,
}: {
  /** Tiptap JSON from getTask; null when empty. */
  description: unknown;
  /** The task's space, for image uploads. */
  spaceId: string;
  onSave: (description: { type: "doc"; [key: string]: unknown } | null) => void;
}) {
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Description" }),
      ...imageExtensions,
      SlashCommand.configure({ spaceId, taskLinks: false }),
    ],
    content: (description ?? "") as Content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich-text min-h-[22px]" },
      // The getter fires only on paste/drop, never during render — the refs rule can't see that.
      // eslint-disable-next-line react-hooks/refs
      ...imageEditorProps(spaceId, () => editorRef.current),
    },
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
    editorRef.current = editor;
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
      // A JSON round-trip: drops `undefined` values the editor's JSON may carry, which server
      // actions can't serialize (as in use-page-autosave).
      saveRef.current(
        pending === null
          ? null
          : (JSON.parse(JSON.stringify(pending)) as { type: "doc"; [key: string]: unknown }),
      );
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

  // Ctrl/Cmd+click on an <a> opens the link in a new tab; the Link extension itself has
  // openOnClick: false so plain clicks keep the caret in the text.
  const onWrapperClick = (e: React.MouseEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const href = (e.target as HTMLElement).closest("a")?.getAttribute("href");
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-w-0 flex-1" onBlur={() => flushRef.current()} onClick={onWrapperClick}>
      {editor && <PageToolbar editor={editor} spaceId={spaceId} />}
      <EditorContent editor={editor} />
    </div>
  );
}
