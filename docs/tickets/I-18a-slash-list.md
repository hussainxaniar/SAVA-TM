# I-18a · The slash menu's list (presentational component)

**Model:** I (GLM 5.3 Flash) · part of `docs/tickets/I-18-slash-menu.md` (the Architect writes the extension, the keyboard handling and the wiring; this is only the visual list).

> **Do not open image files.** Don't browse `node_modules`. One file per Write; files under ~250 lines; don't paste file contents into your messages. Tabler icons only, theme tokens only (no hex colors), dark mode must work. Never touch `prisma/`, `src/server/`, `src/lib/`, `src/hooks/` or `package.json`.

The "/" menu (Notion style) opens at the cursor while someone types `/` in a document page or a task description and filters as they type. The extension and its keyboard handling already exist or are being written by the Architect; you build the list it shows.

## Already there

`src/lib/slash-items.ts` exports `SlashItem` (`id`, `title`, `group`, `icon: SlashIconKey`, `hint?`), `SlashIconKey` (`"text" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "todo" | "quote" | "code" | "divider" | "image" | "task"`) and `groupSlashItems(items)` (returns `{ group, items }[]` in display order).

## Implementer handoff

```
Ticket: I-18a   Read: src/lib/slash-items.ts, src/components/task-dialog/assignee-picker.tsx (the look of a picker list), src/components/ui/dropdown-menu.tsx (menu item and label styling to match)
Files to touch: NEW src/components/rich-text/slash/slash-menu-list.tsx
Do not touch: anything else
```

## What to build

`SlashMenuList` (client component, named export) with props
`{ items: SlashItem[]; selectedIndex: number; onSelect: (index: number) => void; onHover: (index: number) => void }`. `selectedIndex` indexes the flat `items` array (the order you get; groups are only a display layer built with `groupSlashItems(items)`, items keep their flat index).

1. A column `flex w-72 flex-col` (the Architect's container supplies the popup background, border, shadow and `max-h`/scrolling: you render only the list content) with, per group, a small header (`px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground`, the group name) followed by its items.
2. Each item is a `button` (`type="button"`, `role="option"`, `aria-selected`) `flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm`; the selected one `bg-accent text-accent-foreground`. Content: a 28px square icon box (`flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground`) with the Tabler icon for `item.icon` (size 16): text `IconTypography`, h1 `IconH1`, h2 `IconH2`, h3 `IconH3`, bullet `IconList`, numbered `IconListNumbers`, todo `IconSquareCheck`, quote `IconBlockquote`, code `IconCode`, divider `IconSeparatorHorizontal`, image `IconPhoto`, task `IconSubtask`; then `item.title` (`min-w-0 grow truncate`); then `item.hint` when present (`shrink-0 font-mono text-xs text-muted-foreground`).
3. Pointer: `onMouseMove={() => onHover(index)}` (only when `index !== selectedIndex`, to avoid re-render churn), `onMouseDown={(e) => e.preventDefault()}` so the editor keeps focus, `onClick={() => onSelect(index)}`.
4. The selected item scrolls into view when `selectedIndex` changes (`ref` + `scrollIntoView({ block: "nearest" })` in an effect on `selectedIndex`).
5. When `items` is empty render one muted line, `px-2 py-3 text-sm text-muted-foreground`: "No results".
6. The list container has `role="listbox"` and `aria-label="Insert a block"`.

## Acceptance

- [x] The list shows grouped items with icons and shortcut hints, highlights the selected one and scrolls it into view; "No results" when empty.
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
