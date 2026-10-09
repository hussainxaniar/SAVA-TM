# I-16 · Status icon aligned with the task title

**Model:** A (a two-class fix; no Flash dispatch, a dispatch would cost more than the change) · **Sava TM task:** "Align status icon with task text properly" (SAVA TM > Features, priority Medium, due 2026-10-12);
also the real cause behind the screenshot of "Table columns looks a little bit off".

Owner's words: "As you can see in the image, the status icon is not properly aligned with task text." The image (read through the new `get_image` MCP tool) shows every row's icon sitting slightly above the title's centre.

## Cause

The status control's trigger was an inline `button` inside an inline `span` inside a block row. The inline boxes carry the text's line height, so the 18px icon sat in a 25px line box, at its top: **3.3px above the title's vertical centre** (2.5px for the 16px done icon).
It was in every list row, My Tasks, and the dialog's subtasks (they share `StatusControl`).

## Fix

`status-icon.tsx`: the icon variant's button is `flex`; `task-row.tsx`: the wrapper span around the control is `flex`. Nothing else.

## Verification (local, demo account, dark theme)

Measured in the browser before and after, icon centre minus title centre: **-3.3px (done: -2.5px) before, 0.0px after** in all seven rows of "Website relaunch / Backlog"; My Tasks: 0.0px in all five rows; the dialog's subtask rows look aligned in a screenshot.
The stacked (separate-subtasks) layout puts the icon at a fixed offset next to the title line (`mt-px`), which the change does not move.
`pnpm typecheck`, `pnpm lint`, `pnpm test` (304) and `pnpm e2e` (11/11) pass.

**Not verified:** the light theme and phone width (pure box model, no theme or width dependence expected), the stacked layout with a parent label above (unchanged). Not pushed.
