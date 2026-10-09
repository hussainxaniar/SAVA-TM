---
name: sava-erp-task-management
description: Runs the task workflow for the Sava ERP project in Sava TM (tm.sava.af) through the `sava` MCP server. Use whenever you are asked to work on, continue, plan, prioritise, split, update, report on or close a Sava ERP task ("work on my next task", "what's next", "what's on my plate", "plan this feature"), and whenever your work on this repository starts, finishes, gets blocked or finds a bug or follow-up, so the task always shows the truth.
---

# Sava ERP: task workflow (Sava TM)

The team plans and tracks Sava ERP in **Sava TM** (project **"Sava ERP"** on tm.sava.af). Tasks are the practical memory of the project: what we plan, decide and did. This skill makes you run that workflow by yourself, the same way for every agent and person. Rules are the owner's (Hussain Xaniar), recorded 2026-10-09; he adds more over time. When a case is not covered, do the safe thing (comment, ask) rather than invent a rule.

## 0. Who you are and what you can touch

1. `whoami` shows the person whose token you use. You act as them (changes show "via AI"). "My tasks" means **their** tasks.
2. `list_projects` and pick **Sava ERP**. Read its lists and statuses and use the ids it returns; never hard-code ids and never take them from another project.
3. Do **without asking**: read tasks, set a task **In progress** when you start it, create subtasks and follow-up tasks, add comments, move your task to **Review**, **Update** or **Hold**.
4. **Ask first**: marking **Done** or **Canceled**, changing someone else's assignment, priority or due date, pushing or merging code, anything you cannot undo. The MCP cannot delete or move tasks.

## 1. The project's shape

- A project is a closed scope: a list never moves to another project, and every project has its own statuses.
- **Lists in Sava ERP**:

| List | What goes in it |
| --- | --- |
| **Features** | New features, the first version of a feature, improving an existing feature. |
| **Tests & Bugs** | A bug found in an existing feature (currency formatting, amount display, onboarding step problems...). |
| **Global Strategy** | Business strategy, system architecture, fundamentals (finding real business testers, P2P business support...). |
| **Website & Marketing** | Content creation, marketing strategy and hands-on marketing work. |
| **Weekly Task** | What is planned **this week**. A task is *added* here from another list; backlog is never born here. |

- **Statuses** (all exist in Sava ERP):

| Status | Meaning |
| --- | --- |
| **To do** | Backlog: known, not yet planned. |
| **Planned** | Decided and prepared; if it is for this week it is also in Weekly Task. |
| **In progress** | Someone is working on it now. |
| **Review** | Finished by the worker, waiting for validation. |
| **Update** | The review asked for changes; back to the worker. |
| **Hold** | Blocked by something that cannot be resolved for now. |
| **Canceled** | Will not be done. |
| **Done** | The review validated it. |

- **How Features are structured** (follow it when you create tasks): one **parent task per product area** (Products, Parties, Sales, Purchase, Expenses, Account, Settings, Dashboard, Bulk Import/Export, Onboarding Tour, Docs), its **page and flow tasks as children** (the list screen, "New Sale", "Edit Purchase", "Party Details", "Party Payment", "Sale Refund"...), and **subtasks for the steps of one piece of UI work**. For UI work the steps are the pair **"Design in Paper"** then **"Implement in code"** (use "Redesign in paper" when a design exists and changes). A bulk page, a dialog or a form each gets that pair.

## 2. Lifecycle

**Create (backlog).** Choose the list by the nature of the task (table above). Status **To do**, a clear and concise title, and a description a teammate can act on without asking: what, why, what "done" looks like, links to the related task or document. Quote the owner's words when he gave them. Do not invent priority, assignee or dates for something you only noted.

**Plan.** When decided: set **Planned**; assign the right person (`assign_task`; ids from `list_members`), a proper due date and a proper priority (1 urgent, 2 high, 3 medium, 4 none); make the description concrete. If it is for this week it must also be in **Weekly Task**: use `add_task_to_list` with that list's id (the task keeps its own list; `remove_task_from_list` undoes it). Planned needs **no comment**.

**Work.** Start = **In progress** (only what you are actually doing). Finish = **Review**. Changes needed = **Update**. Blocked = **Hold**. Dropped = **Canceled**. Validated = **Done** (the reviewer's call: never set Done on your own work unless the owner says so).

| When | Status | Comment |
| --- | --- | --- |
| You start | In progress | none |
| You finish | Review | usually: what was done, how it was checked, what was not verified, where the details are (branch/commit, document) |
| Review needs changes | Update | what must change and why |
| Blocker you cannot resolve now | Hold | the blocker and who or what unblocks it |
| Will not be done | Canceled | the decision and the reason |
| Validated | Done | only if worth recording |

**Split and discover.** Split big work with subtasks (`create_task` with `parentId`) and mark your own subtasks Done as you finish them. A bug, follow-up or missing piece you find becomes **its own task** in the right list (with a description), linked in the comment of the task you were on, instead of staying in chat.

## 3. Keep the thread of decisions

Description at planning; a short informative comment when a status change carries a decision or event (Update, Hold, Canceled, most Reviews): *what was decided or happened, why, what is next.* No comment for a plain Planned or In progress.
- Review: `Implemented the new-product dialog (Design in Paper then code) on branch feature/x, commit abc1234. pnpm lint and pnpm test pass; checked in the browser in LTR and RTL. Not verified on a phone. Notes added to docs/APP_LOGIC.md.`
- Hold: `Blocked: the exchange-rate rounding rule for invoices is undecided (docs/NOTE.md, options A and B). Resume when the owner picks one.`

## 4. Work routine (when asked to work on a task)

1. **Pick.** `get_my_tasks`; choose by priority (1 first), then due date, then status (In progress and Update before Planned before To do). Say which one you picked and why. If the user named a task, use that one.
2. **Understand.** `get_task` for the description, parent, subtasks, comments and latest activity. Descriptions come back as plain text and **images are not returned**: if a task depends on a screenshot, ask the owner to describe it. Read the parent task for the area's context.
3. **Start.** Set **In progress**. If the task has the "Design in Paper" / "Implement in code" pair, work them in that order and keep their statuses true.
4. **Do the work with this repository's own rules** (`CLAUDE.md` is the authority):
   - UI: existing shadcn components first (`components/ui`, then `components/shared`), semantic color tokens only, no raw palette colors and no manual `dark:` overrides; `PageHeader` for every page header; lucide icons.
   - Designs: read `docs/DESIGN_DIRECTION.md` before designing in Paper and follow `docs/DESIGN_TO_CODE.md` to turn a design into code (no pixel-perfect chase; flag what has no component with a `TODO: needs [component]` note and say so in the comment).
   - Text: all user-facing strings through `next-intl`, added to **all three locales** (`en`, `fa`, `ps`) in the same commit; layouts must work in LTR and RTL.
   - If something needs a new shared component or conflicts with a shared component's API, **stop and flag it** in the task comment instead of improvising.
5. **Check** before saying done: `pnpm lint` and `pnpm test` must pass (`pnpm build` too when you touched build, config or routing). Look at the result in the browser when it is UI.
6. **Record knowledge** (section 5), then **Review** with the comment from section 3. Do not push or merge unless told to.
7. **Report to the person**: what changed, what they can now do, what you did not verify, and the next task you recommend. Then stop; start the next one only when asked.

## 5. Documents are the permanent knowledge

Tasks keep the story; **documents say how the product is**. Any major change, structure or architecture decision, data model, or feature behavior is written into the repository's documents, not only into a task comment, and the task comment points at it:

| Knowledge | Where in this repository |
| --- | --- |
| How a module behaves, online/offline boundary, what each module writes | `docs/APP_LOGIC.md` (update it after a fix: it says so itself) |
| A service or helper and when to use it | `docs/services.md` |
| Derived or cached local collections | `docs/derived-collections.md` |
| The ERP completion plan (payments and party clearing, editing/voiding, stock, reporting, permissions, offline sync, UX) | `docs/erp-completion-blueprint/*` |
| Design direction and design-to-code process | `docs/DESIGN_DIRECTION.md`, `docs/DESIGN_TO_CODE.md` |
| An open question, a known problem, a pending decision with options | `docs/NOTE.md` |

Linking a Sava TM task from a document (and the document feature itself) is not supported yet; mention the task title in the document when it helps. Sava TM documents are reachable through the MCP (tools in section 7): you can list and read them, create docs and pages and edit pages in Markdown. Read a page before editing it, prefer `append` when you only add, and keep this repository's `docs/` files as the technical record. Deleting, moving or archiving documents is done in the app.

## 6. Reporting ("what's on my plate")

`whoami`, then `get_my_tasks`. Answer in this order, one line each (title, priority, status, due date, list): **overdue, due this week, In progress, Update, Review waiting on someone, Planned, Hold.** Recommend the next task and why. Change nothing while only reporting.

## 7. Technical notes (the `sava` MCP)

- Tools: `whoami`, `list_projects`, `list_members`, `list_tasks` (one list; `includeCompleted` optional), `get_my_tasks`, `get_task`, `create_task` (`listId`, optional `parentId`, `statusId`, `priority`, `assigneeIds`, dates, `description`), `update_task`, `set_task_status` (a `statusId`, or `completed: true/false`; exactly one), `assign_task` (replaces all assignees), `add_task_to_list` / `remove_task_from_list` (`taskId`, `listId`: show a task also in another list of its project, for example Weekly Tasks, or undo it; the task keeps its home list), `add_comment`, `quick_add` ("Write brief tomorrow p1 @ada #design"), `list_docs` (a project's docs and their page trees), `get_page` (a page as Markdown with its `updatedAt`), `create_doc`, `create_page`, `rename_doc`, `update_page` (replace or append; pass the `updatedAt` you read as `baseUpdatedAt` and a stale edit is refused with a CONFLICT: read again and retry).
- Dates are ISO (`2026-10-12` or `2026-10-12T15:00:00Z`). Priority is 1 urgent to 4 none. Descriptions and comments are plain text (blank line = new paragraph, `- ` = bullet).
- `completed: true` jumps to the first Done status of the project; use it only when Done is really meant (and allowed).
- A READ token cannot change anything; a WRITE token acts as its owner and everything it writes is labelled "via AI".
- **Not available** (say so, do not work around): delete or move a task, edit lists / statuses / members, delete or move documents and pages, attachments, opening an image (images show as an `[image]` placeholder in task text and as `![alt](src)` in pages; ask the owner to describe a screenshot).

## 8. Not decided yet (ask the owner, do not guess)

Who designs and who implements which area; the git policy for this repository (branches, who merges, when to push); how Weekly Task is planned (which day, how many tasks); how Review is performed (who validates). Ask, then add the answer to this skill.
