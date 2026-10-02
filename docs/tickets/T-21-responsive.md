# T-21 (part 2 of 3) · Mobile: sidebar drawer and layouts below 768px

**Model:** I (GLM 5.3 Flash) · **Section:** 9.1 · **Depends on:** part 1 (the `sava:toggle-sidebar` event)

> **Do not open image files.** Don't browse `node_modules`. One file per Write; keep files under ~250 lines; don't paste file contents into your messages. Tabler icons only, theme tokens only, Base UI conventions as in nearby components. Never touch `prisma/`, `src/server/` or `package.json`. No dependencies, no installers.

## Build

1. **Sidebar** (`src/components/sidebar/sidebar.tsx`): from 768px up it stays as now (260px) and `[` collapses it to 0 width with
   a smooth transition (state in `useLocalStorage("sava.sidebar.collapsed", false)`; a small `IconLayoutSidebar` button in the top-left of the
   main area re-opens it only while collapsed). Below 768px it is hidden and becomes a **left drawer** (a fixed overlay panel 280px wide with
   a dimmed backdrop, slide-in transition, closes on backdrop click, on `Esc`, and on navigation: watch `usePathname()`). Open it with a
   hamburger button (`IconMenu2`) in a slim top bar (48px, `border-b`, shows the page's app name "Sava") that only exists below 768px; the
   `sava:toggle-sidebar` event opens/closes it too. Use the `useSyncExternalStore`-style media query hook you add as
   `src/hooks/use-media-query.ts` (SSR-safe: default to desktop on the server, no hydration warning).
2. **Space layout** (`src/app/(app)/s/[spaceId]/layout.tsx`): the main area fills the rest; below 768px the layout is a column (top bar, content).
3. **Pages below 768px**:
   - list view: the Subs / Assignee / Due / Pri columns collapse: hide the column header row and the Subs and Assignee cells, keep
     status, title, due and flag (`hidden md:flex` utilities in `task-row.tsx`/`status-group.tsx`); `max-w` paddings use `px-4`;
   - task dialog: already full-screen below 768px; make its two columns stack: the properties column goes under the main column
     (`max-md:flex-col`, the aside `max-md:w-full max-md:border-l-0 max-md:border-t`), and the dialog body scrolls as one;
   - calendar: hide the Unscheduled rail below 768px (show a "Unscheduled" button in the toolbar that opens it in a drawer is optional; skip it),
     default to the Day view on mount when narrower than 768px (`api.changeView("timeGridDay")` once);
   - docs: the page tree becomes a collapsible section above the editor (a "Pages" button that toggles it) below 768px;
   - my tasks, integrations, settings pages: just ensure no horizontal scroll (`px-4` on mobile).
4. No horizontal page scroll anywhere at 375px width.

```
Files to touch: src/components/sidebar/sidebar.tsx, NEW src/hooks/use-media-query.ts, src/app/(app)/s/[spaceId]/layout.tsx,
  src/components/tasks/task-row.tsx, status-group.tsx, list-header.tsx, src/components/task-dialog/task-dialog.tsx, properties-column.tsx,
  src/components/calendar/calendar-view.tsx, calendar-grid.tsx, src/components/docs/doc-view.tsx, page-tree.tsx
```

## Acceptance

- [ ] At 1440px nothing changes except `[` collapsing the sidebar. At 375px the sidebar is a drawer behind a hamburger, lists show the
  compact row, the task dialog is full screen with stacked columns, the calendar opens on Day view, and nothing scrolls sideways.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
