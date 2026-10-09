# I-05 · Activity logs: quieter feed, comments first

**Model:** A (Sonnet 5.5 wrote the whole change; it was small enough that no Flash dispatch was made, see the record) · **Source:** the
owner's own tasks on tm.sava.af, project SAVA TM, task "Activity logs" with 3 subtasks (planned and prioritised by the Architect on 2026-10-09).

Owner's words (task descriptions, read through the MCP):

1. *Activity logs even records creating subtasks.* "Creating subtask shouldn't be recorded inside activity log of a parent task. All activities related to the subtask is already recorded inside that subtask … it will make the activity list too large so the user can't notice relevant activities."
2. *Activities should not have avatar.* "Remove avatar from activities. This way, we can make the list more condense."
3. *Comments should be default view if there is comments.* "When there is comments, the default view of Activities section should be only comments."

## What changed

- `src/server/services/tasks.ts`: `createTask` no longer writes `SUBTASK_ADDED` on the parent. The enum value stays (no migration) so old rows
  remain valid; the header comment says it is no longer written. `PARENT_CHANGED` (on the child) is unchanged.
- `src/server/services/comments.ts`: `getFeed` excludes `SUBTASK_ADDED` as well as `COMMENT_ADDED`, so entries written before this change
  disappear from the feed too.
- `src/components/task-dialog/activity.tsx`: activity rows render without an avatar (comments keep theirs); the All / Comments toggle starts on
  Comments when the task has at least one non-deleted comment. The choice is made once, when the feed first arrives; adding the first comment
  in an open dialog does not switch the view.
- `tests/services/tasks.test.ts`: the two expectations that listed `SUBTASK_ADDED` now expect it absent.

## Acceptance

- [x] Creating a subtask leaves the parent's activity untouched; old "added the subtask" lines no longer show.
- [x] Activity lines have no avatar; comments still do.
- [x] A task with comments opens on "Comments"; a task without opens on "All"; the toggle still works.
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass (268 tests, no warnings).

## Completion record (2026-10-09)

Models: Architect (Sonnet 5.5) only. Deviation from the handbook: the UI part (about 10 lines in `activity.tsx`) was written directly instead of
dispatched to GLM Flash, because it was a few-line change next to a service fix and a dispatch costs more than it saves; recorded here so it is a
conscious choice, not a habit.

Browser QA (local dev server, seed user `ada@sava.test`): the parent "Collect stakeholder input" shows no subtask lines and no avatars on activity;
after posting a comment the open dialog stayed on "All"; after a reload the dialog opened on "Comments" showing the comment; no console errors.
Left in the local dev database: one QA comment "QA comment for default view" on that seed task.

Not verified: production (nothing pushed).
