# Icons

Every icon is from `lucide-react`, with **two exceptions**, both taken from the list-view designs
(not from the Paper "Icons" page):

## Subtask

Source: `list-view-nested.jsx.txt` ("Subs" column). 24×24 viewBox, stroked with `currentColor`
(strokeWidth 2, round caps and joins). In code: `SubtaskGlyph` in `src/components/tasks/status-icon.tsx`.

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="6" cy="6" r="2.5" />
  <circle cx="18" cy="18" r="2.5" />
  <path d="M6 8.5V12a3 3 0 0 0 3 3h6.5" />
</svg>
```

## Priority flag (filled)

Source: `list-view-nested.jsx.txt` ("Pri" column). lucide's `Flag` is an outline with a wavy edge, so
it isn't used. 24×24 viewBox, **filled and stroked** with `currentColor` (strokeWidth 2, round caps and
joins); the color comes from `text-priority-1/2/3`. In code: `PriorityFlag` in
`src/components/tasks/priority-flag.tsx`.

```svg
<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 22V4M5 4h13l-2 4.5 2 4.5H5" />
</svg>
```
