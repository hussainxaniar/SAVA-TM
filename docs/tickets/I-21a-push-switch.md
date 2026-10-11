# I-21a · The "Notifications on this device" switch

**Sava TM task:** "Web push notifications …" → subtask "Switch 'Notifications on this device': More tab on a phone, Integrations page on desktop"
**Model:** I (GLM 5.3 Flash) · **Plan:** `docs/tickets/I-21-web-push.md` (read "Decisions" 6 to 8)

> **Do not open image files.** Don't browse `node_modules`. One file per Write; keep files under ~250 lines. Tabler icons only, theme tokens only (no hex),
> no new dependencies. Never touch `prisma/`, `src/server/`, `src/lib/`, `src/hooks/`, `src/components/ui/`, `public/`, `package.json`.
> Never run git commit / stash / checkout.

## Architect part (done, do not change)

`usePush()` from `@/hooks/use-push` returns `{ state, busy, enable, disable }`. `state` is one of:

| state | Meaning | What to show |
| --- | --- | --- |
| `"loading"` | not known yet | the row with a disabled switch (off) |
| `"unconfigured"` | the server has no push keys | **render nothing at all** |
| `"unsupported"` | this browser has no web push | no switch; text "This browser doesn't support notifications." |
| `"needs-install"` | iPhone / iPad in a browser tab | no switch; text "Add Sava TM to your home screen to get notifications: tap Share, then Add to Home Screen." |
| `"blocked"` | notifications are blocked for this site | no switch; text "Notifications are blocked for this site. Allow them in your browser's site settings, then come back." |
| `"off"` | can be turned on | switch off; `enable()` on tap |
| `"on"` | this device gets notifications | switch on; `disable()` on tap |

`enable()` must run directly in the tap handler (the browser only shows its permission prompt then). While `busy`, the switch is disabled.

## What to build

1. **NEW `src/components/notifications/push-switch.tsx`** (`"use client"`): two exports over `usePush()`.
   - `PushSwitch()`: only the control: `<button type="button" role="switch" aria-checked={state === "on"} aria-label="Notifications on this device" disabled={busy || state === "loading"}>`
     48x28, `rounded-full p-0.5 transition-colors disabled:opacity-60` (`bg-primary` when on, `bg-input` when off) with a 24px knob
     (`block size-6 rounded-full bg-white shadow-sm transition-transform`, `translate-x-5` when on). Returns `null` unless the state is `loading`, `off` or `on`.
   - `pushHint(state)`: a plain function returning the text for `unsupported`, `needs-install` and `blocked` (table above), `null` otherwise.
2. **`src/components/mobile/more-view.tsx`**: in the card that holds "Notifications" (the bell row), add a second row under it (the first row then needs the
   `border-b border-divider` the other cards use). When `state === "unconfigured"` the row is not rendered. Row: the same row classes as the others but not a link:
   `IconDeviceMobile` (`size-[22px] text-icon`, `stroke={1.8}`), a column `min-w-0 flex-1` with "Notifications on this device" (`text-base text-foreground`) and, when
   `pushHint(state)` is not null, that text under it (`text-xs leading-4 text-muted-foreground`; the row then is `h-auto min-h-[52px] py-2.5` and `items-start`), and
   `<PushSwitch />` on the right.
3. **NEW `src/components/integrations/push-card.tsx`** (`"use client"`) and **`src/app/(app)/s/[spaceId]/integrations/page.tsx`**: a card on the desktop Integrations page,
   placed after the Google Calendar card. Read `src/components/integrations/google-calendar-card.tsx` first and use the same card frame, heading and text classes.
   Heading "Notifications on this device" with `IconBellRinging`; text "Get a notification on this device when someone assigns you a task, comments, or changes a
   status or due date, even when Sava TM is closed." Under it: `<PushSwitch />` with a label next to it ("On" / "Off", `text-sm text-muted-foreground`), or the
   `pushHint(state)` text when there is one. When `state === "unconfigured"` the card renders nothing.

## Acceptance

- [ ] With push configured: the More tab shows the row and the Integrations page shows the card; turning the switch on asks the browser's permission and, when allowed,
      the switch stays on after a reload; turning it off works.
- [ ] Each of `unsupported`, `needs-install` and `blocked` shows its text and no switch; `unconfigured` shows nothing.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
