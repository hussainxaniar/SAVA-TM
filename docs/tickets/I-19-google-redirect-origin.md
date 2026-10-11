# I-19 · Google connect redirected to localhost:3000

**Model:** A (small fix; no UI) · **Sava TM task:** "Google Calendar connect redirects to localhost:3000 after consent" (SAVA TM > Test & Debug, priority High).

Owner's report (2026-10-10): after connecting Google Calendar and passing Google's consent, the browser lands on localhost:3000 instead of the app's own domain.

## Cause

`src/app/api/google/callback/route.ts` built every redirect from `request.nextUrl.origin`. In production the app runs behind a reverse proxy, so the request's own origin is the internal address (`http://localhost:3000`). Google's own redirect **to** the callback was correct (it uses `APP_URL`); the redirect **back** to the Integrations page was the broken one.
`src/proxy.ts` (the sign-in redirect when there is no session) used the same pattern with `request.url`.

## Fix

`src/lib/app-origin.ts`: `appOrigin(requestOrigin)` returns the origin of the configured `APP_URL` (production: `https://tm.sava.af`) and falls back to the request's origin only when `APP_URL` is missing or invalid (local development). Used in the Google callback (both redirects) and in `proxy.ts`. Tests: `tests/lib/app-origin.test.ts` (2).

## Verification and what is left

`pnpm typecheck`, `pnpm lint`, `pnpm test` (321) and `pnpm e2e` (11/11) pass. **Not verifiable locally:** the proxy setup that causes the bug (local dev has no proxy, so the request origin is already right); the unit tests cover the logic, and the real check is connecting a Google account on tm.sava.af after the deploy (task "Real Google Calendar consent test"). It also assumes `APP_URL` is `https://tm.sava.af` on the server (blueprint 13.5 says so).
Related, not changed: Better Auth's `baseURL` already uses `APP_URL`. Not pushed (no migration).
