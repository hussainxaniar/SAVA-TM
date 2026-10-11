# I-21 · Web push notifications (plan)

**Sava TM task:** "Web push notifications: the app's notifications arrive on the phone or desktop even when Sava TM is closed" (project SAVA TM, Features)
**Model:** A + I · **Blueprint:** Section 16 (in-app notifications); this adds Section 17 · **Branch:** `develop` (assumed; the switch lives in the new More tab)
**State:** planned 2026-10-11, not started. Waiting for the owner's OK on the dependency, the migration and the keys (see "Needs from the owner").

> Owner, 2026-10-11: "The task is just about web push ... enable web-push notification on this app."

## What the user gets

The four notifications of the bell (assigned, commented, status changed, due date changed) also arrive as a system notification on every device where the
user turned "Notifications on this device" on, also when Sava TM is closed. A tap opens the task. Nothing else changes: same recipients, never for your own
action, no new notification types.

## Decisions

1. **Standard Web Push, our own VAPID keys, the `web-push` library** (one new dependency). No hosted service, no cost, nothing leaves our server except the
   request to the browser vendor's push endpoint.
2. **Outbox instead of sending from the services.** Notification rows are written inside the transaction of the activity that caused them (16.1), in many
   services. Sending there would break two rules (no third-party calls inside a transaction; a failed send must not fail the user's action). So:
   - `Notification` gets `pushedAt DateTime?` (null = not yet pushed).
   - `dispatchPendingPushes()` claims the unpushed rows of the last 10 minutes in one statement (`UPDATE … SET pushedAt = now() WHERE pushedAt IS NULL AND
     createdAt > now() - 10 min RETURNING …`, so two requests never send the same row), loads the recipients' subscriptions and sends.
   - It is called in exactly two places, after the response, with Next's `after()`: the `action()` wrapper (`src/server/actions/action.ts`) and the MCP handler
     (`src/server/mcp/handler.ts`). Those are the only ways a change enters the app, so no service has to know about push.
   - The migration sets `pushedAt = createdAt` on the existing rows, so nothing old is ever pushed.
3. **One module touches the network**: `src/server/push/api.ts` (`pushApi.send(subscription, payload)`), like `googleApi`. Tests `vi.spyOn` it.
4. **Dead subscriptions clean themselves**: a 404 or 410 from the push service deletes that subscription; any other error is logged and dropped (no retry
   queue in v1: a missed push is still in the bell).
5. **The text is built on the server** from the same parts the bell uses (`notificationParts`), without the viewer's time zone: a due date shows as its
   calendar day; a due time is left out of the push text (the bell shows it). Title: the actor's name. Body: "assigned you to Homepage layouts". Tag: the
   notification id. URL: `notificationHref(spaceId, n)`.
6. **Off until configured.** Without `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` the switch is not shown and the dispatcher does nothing (as Google Calendar
   without its client id).
7. **Permission is asked only when the user turns the switch on**, never on page load. States the switch shows: on, off, blocked in the browser (with how to
   unblock), not supported, and on an iPhone in Safari: "Add Sava TM to your home screen first" (iOS delivers web push only to a home screen app, 16.4+).
8. **Per device, not per space**: a subscription belongs to a user and a browser; it receives that user's notifications from every space.
9. Not in scope: reminders (need a scheduler), per-type preferences, quiet hours, grouping, a retry queue, replacing the bell's 30 second poll, marking the
   notification read when the push is tapped (opening the task from the bell marks it; the push tap only opens it, v1).

## Data (migration `web_push`, additive)

```prisma
model PushSubscription {
  id         String    @id @default(cuid(2))
  userId     String
  endpoint   String    @unique          // the browser vendor's push URL; identifies the device
  p256dh     String
  auth       String
  userAgent  String?                    // to label the device in the UI later
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
// Notification: + pushedAt DateTime?   + @@index([pushedAt, createdAt])
```

## Services (`src/server/services/push.ts`)

```ts
getPushConfig(): { configured: boolean; publicKey: string | null }
savePushSubscription(ctx, { endpoint, p256dh, auth, userAgent? }): Promise<void>   // upsert by endpoint; a device that changes user moves to the new user
deletePushSubscription(ctx, { endpoint }): Promise<void>                           // only the caller's own; unknown endpoint is a no-op
dispatchPendingPushes(): Promise<void>                                             // internal, never throws
```

Actions `src/server/actions/push.ts`: `getPushConfigAction`, `savePushSubscriptionAction`, `deletePushSubscriptionAction` (the session is the guard: a
subscription is the user's own; no space involved, so `requireMember` does not apply and the ticket records that exception to rule 4).

## Client

- `public/sw.js`: `push` → `showNotification(title, { body, tag, icon, data: { url } })`; `notificationclick` → focus an open Sava TM tab and navigate it, else
  open the URL. No caching, no offline: the worker only handles push.
- `src/app/manifest.ts` (Next metadata route): name, short name, `display: "standalone"`, theme and background colours, icons 192 and 512 (PNG in `public/`,
  maskable). Icons: generated from the "S" mark unless the owner supplies artwork.
- `src/hooks/use-push.ts`: `usePush()` → `{ state: "unsupported" | "needs-install" | "blocked" | "off" | "on" | "unconfigured", enable(), disable(), busy }`.
  `enable()` registers the worker, asks permission, subscribes with the public key, saves the subscription; `disable()` unsubscribes and deletes it.
- UI (implementer): a row "Notifications on this device" with a switch in the phone's More tab (Integrations group) and a card on the desktop Integrations
  page, both over `usePush()`.

## Work split and order

| # | Part | Who |
| --- | --- | --- |
| 1 | Blueprint Section 17 (and 16.1 / 16.6 wording), this ticket | A |
| 2 | Schema + migration, `push.ts` services, `pushApi`, actions, dispatcher hooks in `action()` and the MCP handler, tests | A |
| 3 | Service worker, manifest, icons, `usePush` hook (+ unit test for the state logic) | A |
| 4 | The switch: More tab row and Integrations card (ticket `I-21a-push-switch.md`) | I (GLM 5.3 Flash) |
| 5 | Review, browser QA (two accounts; Chrome desktop with a real subscription), records | A |
| 6 | Real devices: Android Chrome, iPhone home screen app, production keys | owner |

## Tests

Services (real database, `pushApi` faked): a notification for a user with two devices sends two pushes with the right title, body and URL; none for a user
without a subscription; never to the actor; a row is pushed once even when `dispatchPendingPushes` runs twice at the same time; a 410 deletes the
subscription and the others still get theirs; rows older than 10 minutes and rows that existed before the migration are not pushed; saving the same endpoint
twice keeps one row; deleting another user's endpoint does nothing; nothing is sent when the keys are missing. Lib: the push text for each of the four types.

## Acceptance

- [ ] With the switch on in Chrome (desktop) for user B, user A assigning a task to B shows a system notification within a few seconds, with Sava TM closed;
      a click opens the task.
- [ ] Turning the switch off stops them and removes the subscription row.
- [ ] A blocked permission, an unsupported browser and an iPhone outside the home screen app each show their own message instead of a dead switch.
- [ ] A failing push service never fails or slows the user's action.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass; `pnpm e2e` still 11/11.

## Needs from the owner

1. OK for the dependency `web-push` (+ `@types/web-push`) and the migration `web_push` (runs on production with the next push of `main`).
2. VAPID keys: run `npx web-push generate-vapid-keys` once and put `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT=mailto:<your address>` in
   the local `.env` and on the Hetzner server. Keep the private key secret; changing the keys later logs every device out of push.
3. Branch: `develop` (on top of the mobile work) unless you say otherwise.
4. App icon artwork, if you have one (otherwise a plain "S" icon is generated).

## Risks

- iPhone: only as a home screen app, iOS 16.4+; cannot be tested from this machine.
- tm.sava.af must be served over HTTPS with the worker at `/sw.js` (it is); a reverse proxy that caches `/sw.js` would delay worker updates.
- `after()` runs in the same server process: if the process is killed right after a response, that push is lost (it is still in the bell).
