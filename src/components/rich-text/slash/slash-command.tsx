import { Extension, ReactRenderer, type Editor } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { filterSlashItems, type SlashItem } from "@/lib/slash-items";
import { insertImageFiles } from "../image-upload";
import { SlashMenu, type SlashMenuHandle } from "./slash-menu";

/*
 * The "/" menu (Section 11.5). Typing "/" at the start of a line or after a space opens a menu at the
 * cursor; more typing filters it; Enter, Tab or a click applies an item and removes the typed "/text".
 * Docs and task descriptions use it. Not inside code blocks. Options: `spaceId` (needed for the Image
 * item; without it the item is hidden) and `taskLinks` (the Link task item, docs only: it asks the
 * editor's "Link task" popover to open through the window event below).
 */

export const SLASH_LINK_TASK_EVENT = "sava:link-task";

export type SlashOptions = { spaceId?: string; taskLinks: boolean };

const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

function pickImage(editor: Editor, spaceId: string | undefined) {
  if (!spaceId) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = IMAGE_TYPES;
  input.multiple = true;
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length) void insertImageFiles(editor, files, spaceId);
  };
  input.click();
}

const MENU_MAX_HEIGHT = 320;
const GAP = 6;

/** Where the user pressed Escape on an open menu: that "/" stays closed until it is deleted or retyped. */
type Dismissed = { from: number | null };

/** The floating menu: a body-level element placed under the cursor (above it when there is no room). */
function renderMenu(dismissed: Dismissed) {
  let component: ReactRenderer<SlashMenuHandle, SuggestionProps<SlashItem>> | null = null;
  let container: HTMLDivElement | null = null;
  let latest: SuggestionProps<SlashItem> | null = null;
  let stopEscape: (() => void) | null = null;

  const place = (props: SuggestionProps<SlashItem>) => {
    const rect = props.clientRect?.();
    if (!rect || !container) return;
    const below = window.innerHeight - rect.bottom - GAP - 8;
    const above = rect.top - GAP - 8;
    const useAbove = below < Math.min(MENU_MAX_HEIGHT, 200) && above > below;
    container.style.maxHeight = `${Math.max(120, Math.min(MENU_MAX_HEIGHT, useAbove ? above : below))}px`;
    container.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 296))}px`;
    container.style.top = useAbove ? "" : `${rect.bottom + GAP}px`;
    container.style.bottom = useAbove ? `${window.innerHeight - rect.top + GAP}px` : "";
  };

  return {
    onStart(props: SuggestionProps<SlashItem>) {
      component = new ReactRenderer(SlashMenu, { props, editor: props.editor });
      container = document.createElement("div");
      container.className = "fixed z-[70] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10";
      container.appendChild(component.element);
      document.body.appendChild(container);
      place(props);
      latest = props;
      // This Tiptap version does not close the menu on Escape, and an enclosing dialog (the task dialog)
      // would take the key and close itself. So Escape is caught on the window in the capture phase, before the dialog
      // sees it, and closes only the menu: the "/" it belongs to is remembered as dismissed and the
      // plugin re-evaluates (a no-op transaction), which exits the menu.
      const onEscape = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || !latest) return;
        e.preventDefault();
        e.stopPropagation();
        dismissed.from = latest.range.from;
        latest.editor.view.dispatch(latest.editor.state.tr);
      };
      window.addEventListener("keydown", onEscape, true);
      stopEscape = () => window.removeEventListener("keydown", onEscape, true);
    },
    onUpdate(props: SuggestionProps<SlashItem>) {
      latest = props;
      component?.updateProps(props);
      place(props);
    },
    onKeyDown({ event }: SuggestionKeyDownProps) {
      return component?.ref?.onKeyDown(event) ?? false;
    },
    onExit() {
      stopEscape?.();
      stopEscape = null;
      latest = null;
      container?.remove();
      component?.destroy();
      container = null;
      component = null;
    },
  };
}

export const SlashCommand = Extension.create<SlashOptions>({
  name: "slashCommand",

  addOptions() {
    return { spaceId: undefined, taskLinks: false };
  },

  addProseMirrorPlugins() {
    const { spaceId, taskLinks } = this.options;
    const dismissed: Dismissed = { from: null };
    // A dismissed "/" is forgotten once the character at its position is no longer a slash.
    this.editor.on("transaction", ({ editor }) => {
      if (dismissed.from === null) return;
      const at = dismissed.from;
      if (at >= editor.state.doc.content.size || editor.state.doc.textBetween(at, at + 1, "\n", "\n") !== "/") dismissed.from = null;
    });
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        allow: ({ state, range }) => range.from !== dismissed.from && !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => filterSlashItems(query, (item) => (item.id !== "image" || !!spaceId) && (item.id !== "task" || taskLinks)),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          props.run({
            editor,
            pickImage: () => pickImage(editor, spaceId),
            linkTask: () => window.dispatchEvent(new Event(SLASH_LINK_TASK_EVENT)),
          });
        },
        render: () => renderMenu(dismissed),
      }),
    ];
  },
});
