# I-09 · Sava ERP task-management skill

**Model:** A (no code; a skill file and docs) · **Sava TM task:** "Sava ERP task-management skill (task workflow automated for the ERP team's agents)" (SAVA TM > Features, priority Medium).

## Why

The owner said the task-management skill is mostly useful for **Sava ERP** (the product the team sells and builds with Paper designs), and asked for a skill for it "so the tasks get
automated": agents working in the ERP repository should pick their next task, keep its status true, work it with the ERP's own conventions, record knowledge and report, without being told each step.

## What was built

- **`React/sava/.claude/skills/sava-erp-tasks/SKILL.md`** in the **ERP repository** (`connecttoMAHDI/sava`, branch `master`; `.claude/skills` is tracked there). It is **new and uncommitted** there:
  committing/pushing it is the owner's or Mahdi's call (the repo's git policy is one of the open points).
- Contents: who you act as (`whoami`, personal token) and what an agent may do without asking vs must ask; the Sava ERP lists and all eight statuses (incl. **Hold** and **Canceled**, which exist in
  Sava ERP); the structure the project really uses (one parent per product area, page/flow children, "Design in Paper" then "Implement in code" subtasks); the lifecycle (create, plan, work, split, discover)
  with the comment rules; **a work routine** for coding agents (pick by priority/due/status, read the task and its parent, set In progress, follow the repo's `CLAUDE.md` rules: shadcn first, semantic
  tokens, `PageHeader`, `next-intl` in en/fa/ps, RTL, flag instead of improvise, Paper design-to-code guide, `pnpm lint` and `pnpm test`, record knowledge, Review with a comment, report, stop);
  where each kind of knowledge goes in the repo's `docs/`; a reporting order; MCP technical notes and limits; and a short "not decided yet" list so agents ask instead of guessing.
- The generic **`task-management`** skill in Sava TM (I-08) was corrected: **SAVA TM needs only Weekly Tasks, Features and Test & Debug** (it is not a sold product, so no Global Strategy or Marketing
  list), and **Hold / Canceled exist in Sava ERP only**; SAVA TM does not have them and does not need them for now.

## Facts checked while writing (2026-10-09)

Sava ERP's statuses: To do, Planned, In progress, Review, Update, Hold, Canceled, Done. Lists: Weekly Task, Features, Tests & Bugs, Website & Marketing, Global Strategy. The ERP repo's
`CLAUDE.md` rules (shadcn `radix-vega`, Tailwind v4 tokens, `PageHeader`, `next-intl` with en/fa/ps, RTL, "flag, don't build") and scripts (`pnpm lint`, `pnpm test`, `pnpm build`) were read from the repo.

## Open points (the skill tells agents to ask)

1. Who designs and who implements which area. 2. The ERP repo's git policy (branches, who merges, when to push). 3. How Weekly Task is planned. 4. How Review is performed and by whom.
5. Each ERP team member needs **their own MCP token** (Integrations > AI access in Sava TM); the skill assumes it. 6. The MCP gaps listed in I-08 (no add-to-list, no documents, images invisible) limit
   the automation: "add to Weekly Task" still needs a human. An `add_to_list` tool would remove that.

## Acceptance

- [x] A skill for the ERP repo states the workflow in the owner's words and adds the ERP specifics.
- [x] The generic skill and I-08 reflect the owner's corrections.
- [ ] The owner reads it, commits it in the ERP repo (or tells me to) and tries it with a teammate's token.

## Completion record (2026-10-09)

Written by the Architect (Sonnet 5.5); no code changed, so no tests apply. Not run by a fresh agent (skills load at session start). Nothing pushed; the ERP repo was not committed.
