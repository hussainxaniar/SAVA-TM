# I-08 · TaskManagement skill

**Model:** A (no code; a skill file and docs) · **Sava TM task:** "TaskManagement skill: the Sava TM task workflow for agents" (SAVA TM > Features, priority Medium).

## Why

The `sava` MCP gives agents the tools; it does not tell them how this team works. Without that, each agent re-learns the conventions (status meanings, where a task goes, what to
write in a comment, who marks Done) by trial and error. The owner asked for a skill whose main part is the task-management workflow, with the technical notes second.

## What was built

- `.claude/skills/task-management/SKILL.md` (committed, so teammates' agents get it too). Sections: projects/lists/statuses (each project its own scope and statuses), where a task goes
  (Features, Test & Debug, Global Strategy, Marketing), the status meanings including the new **Hold** and **Canceled**, creating backlog, planning (Planned, assignee, due date, priority,
  Weekly Tasks), doing and closing (when to comment, Done belongs to the reviewer), keeping the thread of decisions, documents as the permanent knowledge, a reporting order, the MCP
  technical notes and its limits, and a short section for software projects with a repository.
- `docs/agent-handbook.md` section 2a now points to the skill as the single source for the rules (it keeps only the repository side).

## Owner's rules captured (2026-10-09)

Each project has its own scope and statuses · four standard lists (+ Marketing) and what belongs in each · backlog is created To do in a list except Weekly Tasks · Planned when decided, and added to
Weekly Tasks if for this week · assign, due date, priority at planning · In progress → Review → Update/Done · Hold (blocked) and Canceled · descriptions written at planning, short
informative comments on Update, Hold, Canceled and sometimes Review · documents hold the permanent knowledge, ideally linked to tasks. The owner will add more rules; update the skill and
the date in its first paragraph when he does.

## Gaps found while writing it (not built)

1. ~~Hold and Canceled missing~~ (corrected 2026-10-09): they exist in **Sava ERP**; SAVA TM does not have them and does not need them for now (the owner skipped them).
2. **The MCP cannot add a task to a second list**, so "add to Weekly Tasks" must be done in the app. An `add_to_list` tool would close this.
3. **The MCP has no document tools**, and documents cannot link to tasks yet.
4. **Images in descriptions are invisible to the MCP** (`docToPlain` drops them); an `[image: url]` placeholder would help.
5. ~~No Global Strategy list in SAVA TM~~ (corrected 2026-10-09): SAVA TM is not a sold product and needs only Weekly Tasks, Features and Test & Debug. The Sava ERP skill is I-09.

## Acceptance

- [x] The skill states the workflow in the owner's words and covers the technical notes and the MCP's limits.
- [x] The handbook no longer duplicates the status rules.
- [ ] The owner reads it and adds the rules he remembers.

## Completion record (2026-10-09)

Written and committed locally by the Architect (Sonnet 5.5); no code changed, so no tests apply. Not pushed. Not tested by running a fresh agent against it (skills are loaded at session start).
