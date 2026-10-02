import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

/*
 * Image uploads (I-01): POSTs a file to /api/images (multipart form: file, spaceId) and
 * returns the served URL. insertImageFiles uploads each image file and inserts it into the
 * editor at `pos` (or the current selection), toasting instead of throwing on failure.
 */

export async function uploadImage(file: File, spaceId: string): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("spaceId", spaceId);
  const response = await fetch("/api/images", { method: "POST", body });
  const json = (await response.json().catch(() => null)) as {
    url?: string;
    error?: string;
  } | null;
  if (!response.ok || !json?.url) {
    throw new Error(json?.error ?? "Upload failed");
  }
  return json.url;
}

export async function insertImageFiles(
  editor: Editor,
  files: File[],
  spaceId: string,
  pos?: number,
): Promise<void> {
  // Each image node occupies one position, so sequential inserts keep their order.
  let at = pos ?? editor.state.selection.from;
  for (const file of files.filter((item) => item.type.startsWith("image/"))) {
    try {
      const url = await uploadImage(file, spaceId);
      editor
        .chain()
        .focus()
        .insertContentAt(at, { type: "image", attrs: { src: url } })
        .run();
      at += 1;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }
}
