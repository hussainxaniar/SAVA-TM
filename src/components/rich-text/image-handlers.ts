import type { Editor } from "@tiptap/react";
import { insertImageFiles } from "./image-upload";

/*
 * editorProps pieces for pasting/dropping images (I-01). The handlers only claim image
 * files; everything else falls through to the editor's default paste/drop behavior. The
 * `getEditor` indirection is needed because editorProps is built before the editor exists.
 */

export function imageEditorProps(spaceId: string, getEditor: () => Editor | null) {
  const collectImageFiles = (files: FileList | null | undefined) =>
    Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));

  return {
    handlePaste: (_view: unknown, event: ClipboardEvent) => {
      const files = collectImageFiles(event.clipboardData?.files);
      const editor = getEditor();
      if (files.length === 0 || !editor) return false;
      void insertImageFiles(editor, files, spaceId);
      return true;
    },
    handleDrop: (_view: unknown, event: DragEvent) => {
      const files = collectImageFiles(event.dataTransfer?.files);
      const editor = getEditor();
      if (files.length === 0 || !editor) return false;
      const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      void insertImageFiles(editor, files, spaceId, coords?.pos);
      return true;
    },
  };
}
