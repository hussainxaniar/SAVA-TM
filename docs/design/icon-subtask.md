# Subtask icon

The only custom icon in the app. Use it wherever a subtask glyph appears; every other icon is
from `lucide-react`. Do **not** use the Paper "Icons" page.

Source: the list-view designs (`list-view-nested.jsx.txt`, "Subs" column), 24×24 viewBox,
drawn with `stroke="currentColor"` (strokeWidth 2, round caps and joins):

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="6" cy="6" r="2.5" />
  <circle cx="18" cy="18" r="2.5" />
  <path d="M6 8.5V12a3 3 0 0 0 3 3h6.5" />
</svg>
```

In code: `SubtaskGlyph` in `src/components/tasks/status-icon.tsx`.
