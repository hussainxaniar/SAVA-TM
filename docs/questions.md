# Open Questions

Questions agents write here when a schema or service-layer change seems needed outside a ticket's stated scope.

## Q1 (T-03) — Non-member error code: NOT_FOUND or FORBIDDEN?

Section 7.4 comments `requireMember` as "FORBIDDEN if not a member", but the rule under
it says a missing and a forbidden entity both return `NOT_FOUND` so existence doesn't
leak. T-03 implements the rule: **non-member → NOT_FOUND; member with too low a role →
FORBIDDEN.** Please update the 7.4 comment to match, or say if you want the opposite.

## Q2 (T-03) — `src/middleware.ts` is now `src/proxy.ts`

Next.js 16 deprecated `middleware.ts` and renamed it to `proxy.ts` (same behaviour,
export `proxy`). Sections 3 and 7.1 still say `src/middleware.ts`; please update them
when convenient.

## Q3 (T-04) — Sidebar lives in `s/[spaceId]/layout.tsx`

Section 3's tree marks `(app)/layout.tsx` as "sidebar + task panel host". The sidebar is
space-scoped and only the `[spaceId]` segment knows the space, so the shell went into
`src/app/(app)/s/[spaceId]/layout.tsx`; `(app)/layout.tsx` only validates the session.
Please update the tree comment, or say if you want it done differently.
