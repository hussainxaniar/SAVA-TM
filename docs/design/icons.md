# Icons

The icon set is **Tabler Icons** (`@tabler/icons-react`, https://tabler.io/icons): outline icons by
default (`IconPlus`, `IconCalendar`, …), `…Filled` variants where a solid glyph is wanted (e.g.
`IconFlagFilled` for priority), and a `stroke` prop when a lighter or heavier line is needed. Default
stroke is 2 on the 24px grid, which matches the designs. shadcn's `components.json` has
`"iconLibrary": "tabler"`.

**Exceptions:** the **task status** glyphs and the **subtask** glyph are custom SVGs from the Paper file
"SAVA TM", page **Icons** (exported to `icons-page.jsx.txt`). Both are drawn in `currentColor` and live in
`src/components/tasks/status-icon.tsx`.

## Task statuses (artboard "Task Statuses", 12×12 viewBox)

| Glyph | Used for | Color |
|---|---|---|
| Dashed circle | the first TODO-category status (e.g. "To do") | `text-muted-foreground` |
| Empty circle (stroke 1) | later TODO-category statuses | `text-muted-foreground` |
| Quarter / half / three-quarter pie | ACTIVE-category statuses, by position: one ACTIVE status = half; two = quarter, three-quarter; three = quarter, half, three-quarter | `text-status-active` |
| Filled disc with a knocked-out check | DONE-category statuses | `text-done` (white on the green Done pill) |

`statusGlyphKind(status, statuses)` picks the glyph from the status's place among the project's
statuses; `StatusGlyph` draws it. The pies are the design's wedges as plain paths (radius 6, from
12 o'clock clockwise) over the ring, with no masks, so repeated icons never share SVG ids.

## Subtask (artboard "Subtask", viewBox `1 1 14 14`, stroke 1)

Two small circles joined by an elbow. In code: `SubtaskGlyph`.

```svg
<svg viewBox="1 1 14 14" fill="none" stroke="currentColor">
  <path d="M5 6.5C5.828 6.5 6.5 5.828 6.5 5 6.5 4.172 5.828 3.5 5 3.5 4.172 3.5 3.5 4.172 3.5 5 3.5 5.828 4.172 6.5 5 6.5Z" />
  <path d="M5 7V9C5 10.104 5.896 11 7 11H9" stroke-linecap="square" />
  <path d="M11 12.5C11.828 12.5 12.5 11.828 12.5 11 12.5 10.172 11.828 9.5 11 9.5 10.172 9.5 9.5 10.172 9.5 11 9.5 11.828 10.172 12.5 11 12.5Z" />
</svg>
```
