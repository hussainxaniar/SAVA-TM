"use client";

import { useRef } from "react";
import { BubbleMenu, type Editor } from "@tiptap/react";
import {
  IconBold,
  IconH2,
  IconH3,
  IconItalic,
  IconLink,
  IconList,
  IconPhoto,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { insertImageFiles } from "@/components/rich-text/image-upload";

/*
 * The selection toolbar (Section 11.1): a BubbleMenu that appears on a text selection with
 * Bold, Italic, Link, H2, H3, a bullet list and — when a `spaceId` is available — an Image
 * button that uploads a picked file into the doc. Buttons use onMouseDown → preventDefault so
 * clicking one keeps the selection; each then focuses the editor and runs its command.
 */

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function PageToolbar({ editor, spaceId }: { editor: Editor; spaceId?: string }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setLink = () => {
    const existing = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", existing ?? "");
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: trimmed }).run();
  };

  const pickImage = () => {
    fileInputRef.current?.click();
  };
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!spaceId || files.length === 0) return;
    void insertImageFiles(editor, files, spaceId);
  };

  return (
    <>
      <BubbleMenu editor={editor}>
        <div className="flex items-center gap-0.5 rounded-lg bg-popover p-0.5 shadow-md ring-1 ring-foreground/10">
          <ToolButton
            active={editor.isActive("bold")}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <IconBold className="size-4" />
          </ToolButton>
          <ToolButton
            active={editor.isActive("italic")}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <IconItalic className="size-4" />
          </ToolButton>
          <ToolButton active={editor.isActive("link")} label="Link" onClick={setLink}>
            <IconLink className="size-4" />
          </ToolButton>
          <ToolButton
            active={editor.isActive("heading", { level: 2 })}
            label="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <IconH2 className="size-4" />
          </ToolButton>
          <ToolButton
            active={editor.isActive("heading", { level: 3 })}
            label="Heading 3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <IconH3 className="size-4" />
          </ToolButton>
          <ToolButton
            active={editor.isActive("bulletList")}
            label="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <IconList className="size-4" />
          </ToolButton>
          {spaceId && (
            <ToolButton active={false} label="Image" onClick={pickImage}>
              <IconPhoto className="size-4" />
            </ToolButton>
          )}
        </div>
      </BubbleMenu>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-hidden="true"
        tabIndex={-1}
        className="hidden"
        onChange={onFileChange}
      />
    </>
  );
}
