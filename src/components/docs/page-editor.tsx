"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Content, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { usePage } from "@/hooks/use-doc";
import { usePageAutosave } from "@/hooks/use-page-autosave";
import { relativeTime } from "@/lib/activity-format";
import type { DocPageDTO, UserLite } from "@/server/services/types";
import { imageEditorProps } from "@/components/rich-text/image-handlers";
import { imageExtensions } from "@/components/rich-text/resizable-image";
import { PageToolbar } from "./page-toolbar";

/*
 * The page editor (Sections 11.1 / 11.2): title, Tiptap body, selection toolbar, conflict
 * banner and footer. Saving goes through usePageAutosave; the footer reads the live page from
 * usePage so the "Edited by" line and updatedAt follow every save. On Reload the body remounts
 * (it is keyed on the autosave's `version`) with the server's content.
 */

export type PageEditorProps = {
  docId: string;
  spaceId: string;
  page: DocPageDTO;
  me: UserLite;
};

/** The Tiptap body. A child component so Reload can remount it whole (keyed by `version`). */
function EditorBody({
  content,
  onChange,
  onFlush,
  onReady,
  spaceId,
}: {
  content: unknown;
  onChange: (json: JSONContent) => void;
  onFlush: () => void;
  onReady: (editor: Editor) => void;
  spaceId: string;
}) {
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      ...imageExtensions,
    ],
    content: (content ?? "") as Content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich-text min-h-[50vh] outline-none" },
      ...imageEditorProps(spaceId, () => editorRef.current),
    },
  });

  // `last` is the JSON of the previous update: the update Tiptap fires when content is set
  // programmatically replays the same JSON, so it is skipped and only real edits are reported.
  useEffect(() => {
    if (!editor) return;
    editorRef.current = editor;
    onReady(editor);
    let last = JSON.stringify(editor.getJSON());
    const onUpdate = ({ editor: ed }: { editor: Editor }) => {
      const json = ed.getJSON();
      const s = JSON.stringify(json);
      if (s === last) return;
      last = s;
      onChange(json);
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, onChange, onReady]);

  return (
    <div onBlur={onFlush}>
      {editor && <PageToolbar editor={editor} spaceId={spaceId} />}
      <EditorContent editor={editor} />
    </div>
  );
}

export function PageEditor(props: PageEditorProps) {
  const { docId, me, spaceId } = props;
  const { data: livePage } = usePage(docId, props.page.id, props.page);
  const page = livePage ?? props.page;
  const { status, conflict, version, change, flush, overwrite, reload } = usePageAutosave({
    docId,
    page,
    me,
  });

  const [title, setTitle] = useState(page.title);
  const changeRef = useRef(change);
  const flushRef = useRef(flush);
  const editorRef = useRef<Editor | null>(null);
  const pageRef = useRef(page);
  useEffect(() => {
    changeRef.current = change;
    flushRef.current = flush;
    pageRef.current = page;
  });

  // Reload takes the server's version: reset the title field to it (the body remounts below).
  useEffect(() => {
    setTitle(pageRef.current.title);
  }, [version]);

  const onTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTitle(value);
    // The server rejects an empty title.
    changeRef.current({ title: value.trim() || "Untitled" });
  };
  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      editorRef.current?.commands.focus("start");
    }
  };

  const handleChange = useCallback((json: JSONContent) => {
    changeRef.current({ content: json });
  }, []);
  const handleFlush = useCallback(() => {
    void flushRef.current();
  }, []);
  const handleReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const statusText =
    status === "saved"
      ? "Saved"
      : status === "error"
        ? "Couldn't save. Retrying on your next edit."
        : status === "conflict"
          ? null
          : "Saving…";

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pb-24 pt-6">
      {conflict && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <IconAlertTriangle aria-hidden className="size-4 shrink-0 text-overdue" />
          <p className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-medium text-foreground">{conflict.updatedBy.name}</span> changed
            this page. Reload to see their version.
          </p>
          <Button variant="ghost" size="sm" onClick={() => void reload()}>
            Reload
          </Button>
          <Button size="sm" onClick={() => void overwrite()}>
            Overwrite
          </Button>
        </div>
      )}
      <textarea
        rows={1}
        value={title}
        onChange={onTitleChange}
        onKeyDown={onTitleKeyDown}
        onBlur={handleFlush}
        placeholder="Untitled"
        aria-label="Page title"
        className="field-sizing-content w-full resize-none bg-transparent p-0 text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-foreground outline-none placeholder:text-muted-foreground"
      />
      <EditorBody
        key={version}
        content={page.content}
        onChange={handleChange}
        onFlush={handleFlush}
        onReady={handleReady}
      />
      <p className="mt-6 text-[13px] text-muted-foreground">
        Edited by {page.updatedBy.name} · {relativeTime(page.updatedAt)}
        {statusText && <> · {statusText}</>}
      </p>
    </div>
  );
}
