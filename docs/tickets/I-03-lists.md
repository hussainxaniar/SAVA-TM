# I-03 · New list from the project menu, and list icons

**Model:** I (GLM 5.3 Flash)

> **Do not open image files.** Don't browse `node_modules`. One file per Write; keep files under ~250 lines; don't paste file contents into your messages. Tabler icons only (plus the existing `StatusGlyph` etc.), theme tokens only, Base UI conventions as in nearby components. Never touch `prisma/`, `src/server/`, `src/lib/` or `package.json`.

## Already done (Architect)

- `List.icon` (a key of `LIST_ICON_KEYS` in `src/lib/list-icons.ts`, or null) is returned by the sidebar
  (`project.lists[].icon`), project settings (`lists[].icon`) and the list view (`data.list.icon`).
- `createListAction({ projectId, name, icon? })` and `updateListAction({ listId, icon })` (null = default) exist.

## Build

1. **`src/components/list-icon.tsx`**: `ListIcon({ icon, className })` renders the Tabler icon for a key (default
   `IconList`). Mapping: list→IconList, inbox→IconInbox, checklist→IconChecklist, target→IconTarget, flag→IconFlag,
   star→IconStar, bookmark→IconBookmark, bug→IconBug, bulb→IconBulb, rocket→IconRocket, calendar→IconCalendar,
   chart→IconChartBar, code→IconCode, palette→IconPalette, megaphone→IconSpeakerphone, heart→IconHeart, home→IconHome,
   briefcase→IconBriefcase, users→IconUsers, shopping→IconShoppingCart, book→IconBook, flask→IconFlask, bell→IconBell,
   lock→IconLock. Also export `LIST_ICON_COMPONENTS` (the record) for the picker.
2. **`src/components/list-icon-picker.tsx`**: `ListIconPicker({ value, onChange })`: a `Popover` trigger (the current icon, 28px ghost
   button, `aria-label="List icon"`) whose content is a 6-column grid of the 24 icons (32px buttons, the selected one
   `bg-selected text-selected-foreground`), each with `aria-label` and `title` = its key; picking calls `onChange(key)`
   (the first icon "list" sends `null`) and closes the popover.
3. **Show it:** in `src/components/sidebar/project-tree.tsx` replace the list row's `IconList` with
   `<ListIcon icon={list.icon} className=... />` (same classes and sizes); in the list header
   (`src/components/tasks/list-header.tsx`) show the list's icon (20px, muted) before the title.
4. **Change it:** in the project settings lists editor (`src/components/project-settings/lists-editor.tsx`) put a
   `ListIconPicker` before each list's name; on change call `updateListAction({ listId, icon })`, `toast.error` on
   failure, and `router.refresh()`. Do the same from the list header's `⋯` menu: add **Change icon** that opens the picker
   (a controlled `Popover` anchored to the title row) and updates through `useUpdateList...` if one exists, else
   `updateListAction` + `router.refresh()` + an optimistic update of the cached list view
   (`['tasks', listId]`: `{ ...data, list: { ...data.list, icon } }`).
5. **New list** (sidebar, `project-tree.tsx`): the project's `⋯` menu gets **New list** (`IconListDetails`) next to **New doc**.
   It calls `createListAction({ projectId: project.id, name: "New list" })` and on success
   `router.push(`/s/${spaceId}/p/${project.id}/l/${res.data.listId}`)`; on failure `toast.error`. (The list header's
   title is click-to-rename, so naming happens there.)

```
Files to touch: NEW src/components/list-icon.tsx, list-icon-picker.tsx; src/components/sidebar/project-tree.tsx,
  src/components/tasks/list-header.tsx, src/components/project-settings/lists-editor.tsx
Files you may read: src/lib/list-icons.ts, src/server/actions/lists.ts, src/hooks/use-list-view.ts, src/components/ui/*
Do not touch anything else. No dependencies, no installers.
```

## Acceptance

- [ ] **New list** in the project menu creates "New list" and opens it. Lists show their icon in the sidebar and header;
  it can be changed from the header menu and from project settings, and the sidebar updates.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
