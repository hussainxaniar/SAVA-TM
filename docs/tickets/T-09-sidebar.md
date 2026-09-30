# T-09 (part 1) · Sidebar redesign to match the Paper design

**Model:** I · **Design:** `docs/design/list-view-nested.jpg` (left 260px column) and the exact
styles in `docs/design/list-view-nested.jsx.txt` (the first `<div>` with `width: '260px'`).

## Implementer handoff

```
Ticket: T-09 part 1 — restyle the sidebar to the Paper design
Read: docs/blueprint.md section 9.1, 9.8; this file; docs/design/list-view-nested.jpg; docs/design/list-view-nested.jsx.txt (sidebar block only)
Files to touch (ONLY these):
  src/components/sidebar/sidebar.tsx
  src/components/sidebar/project-tree.tsx
  src/components/sidebar/new-project-dialog.tsx
  src/components/sidebar/user-menu.tsx
  src/components/sidebar/space-switcher.tsx
Files you may read: src/components/ui/*, src/components/theme-toggle.tsx, src/lib/quick-add.ts,
  src/lib/list-view.ts (avatarColors, initials), src/lib/project-colors.ts, src/server/services/types.ts (SidebarDTO),
  src/server/actions/projects.ts, src/app/(app)/s/[spaceId]/layout.tsx, src/app/globals.css (tokens)
Do not touch: prisma/, src/server/, src/app/, src/lib/, src/hooks/, package.json, any other file.
Do not add dependencies. Do not run shadcn, prisma or any installer.
```

Keep all existing behaviour (drag-reorder projects, collapse persistence, ⋯ menu with Rename / Color /
Project settings / Archive, new-project dialog with "Copy statuses from…", sign out). **Only the look and
layout change**, plus the additions listed below. Keep the export names; prop changes are listed.

### Colors: use theme tokens, not hex

The design is light-only; the app also has dark mode. Map design colors to tokens:

| Design hex | Use |
|---|---|
| `#F6F6F7` sidebar background | `bg-sidebar` |
| `#E8E8EA` borders | `border-sidebar-border` / `border-border` |
| `#18181B` / `#000` text | `text-foreground` |
| `#3F3F46` secondary text | `text-foreground/80` |
| `#71717A`, `#52525B` muted text and icons | `text-muted-foreground` |
| `#2563EB` blue | `text-primary` / `bg-primary` |
| `#E9EFFE` bg + `#1D4ED8` text (active list) | `bg-selected text-selected-foreground` |
| row hover | `hover:bg-sidebar-accent` |

### Layout, top to bottom (all sizes from the design)

`<aside>`: `w-[260px] shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border px-2 py-3`.

1. **Space switcher** (`space-switcher.tsx`): trigger row `h-9 px-2 gap-2`. The avatar is a 24px `rounded-md`
   square with **`bg-foreground text-background`** (near-black in the design, not blue), 12px semibold
   letter. Name 14px semibold, grows. `ChevronsUpDown` 16px muted. **Add** to the menu, after the spaces
   group: a `DropdownMenuSeparator` and an item **"Space settings"** (`Settings` icon) →
   `router.push(\`/s/${current.id}/settings\`)`. (The design's footer has no settings link, so it moves here.)
2. **Add task** (`sidebar.tsx`): `mt-2 h-9 px-2 gap-2 rounded-md hover:bg-sidebar-accent`, a `<button>`:
   20px `rounded-full bg-primary` circle with a white 12px `Plus` (strokeWidth 3); label "Add task" 14px
   semibold `text-primary`, grows; a key chip "Q" (`rounded-[4px] border bg-background px-[5px] text-xs
   font-medium text-muted-foreground`). onClick → `requestQuickAdd()` from `@/lib/quick-add`.
3. **Nav** (`mt-1`): My Tasks (`CircleCheck`) and Calendar (`CalendarDays`). Rows `h-8 px-2 gap-2.5 rounded-md`,
   icons 18px `text-muted-foreground`, label 14px `text-foreground`. Active (pathname starts with href):
   `bg-selected text-selected-foreground font-medium` (icon too).
4. **Projects header** (`mt-5 h-7 px-2 flex items-center`): "Projects" 12px semibold
   `tracking-[0.02em] text-muted-foreground`, grows; a 16px `Plus` icon button (`aria-label="New project"`)
   that opens the New project dialog.
5. **Project tree** (`project-tree.tsx`, `flex flex-col gap-px`):
   - **Project row** `h-8 pl-1 pr-2 gap-1.5 rounded-md hover:bg-sidebar-accent`: chevron button 14px
     (`ChevronDown` when expanded, `ChevronRight` when collapsed, strokeWidth 2.4, muted), then the
     **color square** `size-2 rounded-[2px] mx-1` (inline background = project color; the emoji instead if
     `icon` is set), then the name 14px **medium** `text-foreground` (a Link to the project, as now). Projects
     after the first get `mt-1`. The grip handle stays **only on hover** and must not shift the layout: position
     it absolutely over the left edge (e.g. `absolute -left-2`), keeping `{...attributes} {...listeners}` on it.
     The `⋯` menu trigger stays on hover at the right.
   - **List rows** (children, no extra wrapper indent): `h-8 pl-9 pr-2 gap-2 rounded-md hover:bg-sidebar-accent`:
     lucide `List` icon 16px muted, name 14px `text-foreground/80` (grows, truncate), and at the right the
     **`openTaskCount`** (new field on each list) as 12px `text-muted-foreground`, hidden when 0. Active list:
     `bg-selected text-selected-foreground font-medium`; the icon and count also use `text-selected-foreground`.
   - **Doc rows**: the same as list rows, with a `FileText` icon and no count. **Remove the "Docs" label**: in the design,
     docs sit directly after the lists.
   - **New project** row (`mt-1 h-8 px-2 gap-2`): `Plus` 16px muted and "New project" 14px muted; opens the dialog.
6. Spacer (`flex-1`).
7. **Footer** (`user-menu.tsx` + `sidebar.tsx`): `-mx-2 h-10 px-4 border-t border-sidebar-border flex items-center gap-2`.
   The user menu trigger shows a **24px round avatar** with colors from `avatarColors(userId)` (inline
   `backgroundColor: bg, color: fg`), `initials(name)` 11px semibold (use the image instead when set),
   then the name 14px medium (grows, truncate). At the right, **`<ThemeToggle />`** from
   `@/components/theme-toggle`, outside the menu trigger. Remove the old "Space settings" footer link (it
   moved to the switcher). `UserMenu` needs the user id for colors: change its props to
   `{ user: { id: string; name: string; email: string; image: string | null } }` (the layout already
   passes `id`, and `SidebarProps.user` already includes it).

### New project dialog: two triggers

`NewProjectDialog` must open from both the header `+` and the "New project" row. Make it **controlled**:
props become `{ spaceId: string; projects: { id: string; name: string }[]; open: boolean; onOpenChange: (open: boolean) => void }`,
render no trigger of its own, and let `sidebar.tsx` own `const [newProjectOpen, setNewProjectOpen] = useState(false)`
and render both triggers. Keep its form, validation and behaviour exactly as now.

## Acceptance

- [ ] Sidebar matches the design at 1440×900 (compare with `docs/design/list-view-nested.jpg`).
- [ ] Add task button calls `requestQuickAdd()`; the theme toggle works; Space settings is in the switcher menu.
- [ ] All T-06 behaviour still works; list counts show; the active list is highlighted blue.
- [ ] Only the five files above changed. `pnpm typecheck && pnpm lint && pnpm test` pass with no lint warnings.
