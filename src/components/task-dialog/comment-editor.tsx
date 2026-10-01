"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";

/** A comment body as stored in the database (Tiptap JSON). */
export type CommentBody = { type: "doc"; [key: string]: unknown };

/**
 * The comment composer (T-15 §4) and the inline edit field. A rounded field that grows with its
 * content: Ctrl/Cmd+Enter or the button submits (then clears and keeps focus), Enter makes a new
 * line, Esc calls onCancel (stopPropagation keeps the dialog open). The submit button shows only
 * while there is text; Cancel shows whenever an onCancel is given.
 */
export function CommentEditor({
  initial,
  placeholder = "Comment",
  onSubmit,
  onCancel,
  submitLabel = "Send",
}: {
  /** Tiptap JSON to prefill (inline edit). */
  initial?: unknown;
  placeholder?: string;
  onSubmit: (body: CommentBody) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [hasText, setHasText] = useState(false);

  // The editor's key handler is fixed at mount, so it goes through refs that stay current.
  const submitRef = useRef<() => void>(() => {});
  const cancelRef = useRef(onCancel);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    cancelRef.current = onCancel;
    onSubmitRef.current = onSubmit;
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: (initial ?? "") as Content,
    // Inline edit takes focus (caret at the end) so typing, Esc and Ctrl/Cmd+Enter go to it;
    // the composer doesn't grab focus when the dialog opens.
    autofocus: initial ? "end" : false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich-text" },
      // Runs on the editor element, so stopPropagation here keeps Esc from reaching the dialog.
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          submitRef.current();
          return true;
        }
        if (event.key === "Escape" && cancelRef.current) {
          event.preventDefault();
          event.stopPropagation();
          cancelRef.current();
          return true;
        }
        return false;
      },
    },
  });

  const submit = useCallback(() => {
    if (!editor || editor.isEmpty) return;
    onSubmitRef.current(editor.getJSON() as CommentBody);
    editor.commands.clearContent(true); // emit an update, so "Send" hides again
    editor.commands.focus();
  }, [editor]);

  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    if (!editor) return;
    const update = () => setHasText(!editor.isEmpty);
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  return (
    <div className="flex min-h-11 items-start gap-2 rounded-[22px] border border-border px-4 py-2.5">
      <div className="min-w-0 grow">
        <EditorContent editor={editor} />
      </div>
      {hasText && (
        <Button
          size="sm"
          aria-label={`${submitLabel} comment`}
          onClick={submit}
          className="-my-px h-6 shrink-0 px-2.5 text-xs" // keeps the field at the design's 44px
        >
          {submitLabel}
        </Button>
      )}
      {onCancel && (
        <Button variant="ghost" size="sm" onClick={onCancel} className="-my-px h-6 shrink-0 px-2.5 text-xs">
          Cancel
        </Button>
      )}
    </div>
  );
}