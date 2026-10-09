---
name: task-management
description: How this team plans, tracks and closes work in Sava TM (tm.sava.af) through the `sava` MCP server. Use when asked what to work on, to prioritise or plan tasks, to create, split, update, comment on or close a task, to report progress ("what's on my plate"), or whenever a task's status should change because work started, finished, blocked or was cancelled.
---

# Task management in Sava TM

Tasks are the team's day-to-day source of ground truth: what we plan, what we decided, what happened. Keep them accurate and informative, in the same way for every agent and person. This file is the workflow; the tool notes are at the end. (Rules from the owner, 2026-10-09; he adds more as he remembers them, so check the date and ask when a case is not covered.)

## 1. Projects, lists and statuses

- **A project is a closed scope.** A list belongs to one project and can never be moved or added to another project. Never copy ids across projects.
- **Every project has its own statuses** (names look alike, ids differ). Always read them from `list_projects` for the task's project; never reuse a status id from another project.
- A development project normally has these **lists**:

| List | What goes in it |
| --- | --- |
| **Weekly Tasks** | What is planned for this week. Tasks are *added* here from other lists (see 3); nothing is born here as backlog. |
| **Features** | New features, the first version of a feature, improvements to an existing feature. |
| **Test & Debug** (or "Tests & Bugs") | A bug found in an existing feature. |
| **Global Strategy** | Business strategy, system architecture, fundamentals. |
| **Marketing** (or "Website & Marketing") | Only for products we sell: content creation, marketing strategy and hands-on marketing work. |

- **Which lists a project has depends on the project.** SAVA TM (the task manager itself, not a sold product) only needs **Weekly Tasks, Features and Test & Debug**; it has no Global Strategy or Marketing list and does not need one. **Sava ERP** has all five (Weekly Task, Features, Tests & Bugs, Website & Marketing, Global Strategy) and has its own skill, `sava-erp-tasks`, in the ERP repository. Use the lists a project really has; do not create new ones without the owner.
- **Statuses**, in the order a task usually travels:

| Status | Meaning |
| --- | --- |
| **To do** | Backlog. Known, not yet planned. |
| **Planned** | Decided and prepared (description, owner, date, priority set). If it is for this week it is also in Weekly Tasks. |
| **In progress** | Someone is working on it now. |
| **Review** | Done by the worker, waiting for a reviewer to validate. |
| **Update** | The review found something to change; back to the worker. |
| **Hold** (where the project has it) | Blocked by something that cannot be resolved for now. |
| **Canceled** (where the project has it) | Will not be done. |
| **Done** | The review validated it. |

`Hold` and `Canceled` exist in **Sava ERP** only. **SAVA TM does not have them and does not need them for now**: there, record a blocker as a comment (and use Update only if a reviewer asked for changes) and ask the owner before dropping a task. Never try to create a status (the MCP cannot); if a project you work in lacks one you need, ask the owner. Check the project's real statuses with `list_projects`.

## 2. Creating a task (backlog)

1. Pick the list by the nature of the task (table above). New backlog is created with status **To do** in that list, never in Weekly Tasks.
2. Write a clear, concise **title** and a **description** that the next person can act on without asking: what, why, what "done" looks like, links to the related task, file or document. Quote the owner's own words when they gave them.
3. Do not invent priority, assignee or dates for backlog you only noted. Set them when planning.

## 3. Planning a task

When the task is decided:
1. Set status **Planned**.
2. Assign the **right person** (`assign_task`, ids from `list_members`), a proper **due date** and a proper **priority** (1 urgent, 2 high, 3 medium, 4 none; `update_task`).
3. If it is to be done this week, it must also appear in **Weekly Tasks** (it is added there as a link; the task keeps its own list). The MCP has no "add to list" tool yet: say so and ask the owner to add it in the app, or create it in Weekly Tasks only when the owner asks for a weekly-only item.
4. Improve the description if planning taught you something. Moving To do → Planned needs **no comment**.

## 4. Doing and closing a task

| When | Set status | Comment? |
| --- | --- | --- |
| You start working | **In progress** (keep it to what you are really doing, one at a time per person) | No |
| The work is finished | **Review** | Often yes: what was done, how it was checked, what was not verified, where the details are (commit, ticket, document) |
| The review asks for changes | **Update** | Yes: what must change and why |
| You hit a blocker that cannot be resolved now | **Hold** (if the project has it; otherwise a comment only) | Yes: the blocker, who or what can unblock it |
| The task will not be done | **Canceled** (if the project has it; otherwise ask the owner) | Yes: the decision and the reason |
| The reviewer validates it | **Done** | Only if something is worth recording |

- **Done belongs to the reviewer.** An agent that built something moves it to Review and stops. Mark Done only when the owner or reviewer has said it is validated (or asks you to).
- **Split big work** with subtasks (`create_task` with `parentId`); mark your own subtasks Done as you finish them. The parent follows the rules above.
- **Found something new while working?** (a bug, a follow-up, a missing piece) Create a task for it in the right list instead of leaving it in chat; link it in the comment of the task you were on.

## 5. Keep the thread of decisions

Tasks hold the story, so write it:
- **Description**: written at planning time; update it when the understanding changes.
- **Comment** whenever a status change carries a decision or an event: Update, Hold, Canceled, and most Reviews. Short and informative: *what was decided or happened, why, what is next.* A plain Planned or In progress change needs none.
- Example Review comment: `Built and committed (abc1234); ticket docs/tickets/I-07.md. Typecheck, lint, 281 tests and the e2e flows pass; checked in a browser. Not pushed; not verified on a phone.`
- Example Hold comment: `Blocked: the Google consent screen is in Testing and only the owner can publish it. Resume when it is published; until then the calendar sync cannot be tested for real.`

## 6. Documents are the permanent knowledge

Tasks say what happened; **documents say how things are**: major changes, structure and architecture decisions, data model, how a feature behaves. Record that kind of knowledge in the project's documents, not only in a task comment, and mention the relevant task where it helps. Linking a document to its task is not supported yet (the document feature needs updating).
The MCP has **no document tools yet**, so an agent cannot read or write documents there: say so, and for software projects keep this knowledge in the repository's docs (blueprint, handbook, tickets) until the MCP can reach documents.

## 7. Reporting ("what's on my plate")

Start with `whoami`, then `get_my_tasks` (or `list_tasks` for a list). Answer in this order, one line each: title, priority, status, due date, project / list.
**Overdue → due this week → In progress → Review (waiting on someone) → Planned → Hold.** Say which task you recommend next and why. Do not change anything while only reporting.

## 8. Technical notes (the `sava` MCP)

- First calls: `whoami` (who you act as, space, whether you can write), `list_projects` (projects, their lists with ids, their statuses with ids). Every id you pass must come from these tools.
- Tools: `list_tasks` (one list; `includeCompleted` optional), `get_my_tasks`, `get_task` (description, subtasks, latest comments and activity), `create_task` (`listId`; `parentId` for a subtask; `statusId`, `priority`, `assigneeIds`, dates, `description`), `update_task`, `set_task_status` (a `statusId`, or `completed: true/false`; exactly one), `assign_task` (replaces all assignees), `add_comment`, `quick_add` (one-line natural text such as "Write brief tomorrow p1 @ada #design"), `list_members`.
- Dates are ISO: `2026-10-12` for a day, `2026-10-12T15:00:00Z` for a moment. Priority is 1 urgent, 2 high, 3 medium, 4 none.
- Descriptions and comments are **plain text**: blank lines separate paragraphs, lines starting `- ` are bullets. **Images in a description are not returned**, so ask the owner when a task says "see screenshot".
- Your changes appear in the app as made by the token's owner, labelled "via AI". A READ token cannot change anything.
- **Not available** (say so instead of working around it): delete or move a task, add a task to a second list (Weekly Tasks), edit lists / statuses / members, documents, attachments.
- `set_task_status` with `completed: true` jumps to the project's first Done status; use it only when Done is really meant.

## 9. For a software project with a repository (Sava TM itself)

Besides the task, every piece of work is recorded as a ticket in the repository (`docs/tickets/`, `docs/progress.md`) with the technical details: see `docs/agent-handbook.md` section 2a. The task answers "what and where is it now"; the ticket answers "how was it built and checked".
