import * as chrono from "chrono-node";
import { dateOnlyISO } from "./list-view";

/**
 * Quick-add text parser (Section 9.3). Pure and synchronous so it can run on every keystroke.
 *
 * Tokens:
 *   natural date  → due date (chrono-node): `tomorrow`, `fri 3pm`, `next week`, `in 3 days`
 *   `p1`–`p4`     → priority
 *   `@handle`     → assignee (see memberHandle)
 *   `#handle`     → list in the target project (see listHandle)
 *
 * Rules:
 * - Tokens only count at a word start (`me@x.com` and `a#b` are plain text) and only when they
 *   resolve: an unknown `@bob` or `#123` stays in the title.
 * - Recognised tokens are removed from the title. For single-valued fields (date, priority, list)
 *   the first occurrence wins; later ones stay in the title as text. Assignees accumulate.
 * - A date must name a day, a weekday or a time ("March" alone is not a due date), and the word
 *   "now" is never a date. A preposition right before the date (`by`, `on`, `at`, `due`,
 *   `before`) is removed with it: "Email Bob by monday" → "Email Bob".
 * - `ignore` holds tokenKey()s the user dismissed (the chip's ×): those stay as title text.
 */

export type QuickAddMember = { id: string; name: string };
export type QuickAddList = { id: string; name: string };

export type QuickAddToken =
  | { kind: "date"; text: string; start: number; end: number; dueDate: string; dueHasTime: boolean }
  | { kind: "priority"; text: string; start: number; end: number; priority: 1 | 2 | 3 | 4 }
  | { kind: "assignee"; text: string; start: number; end: number; memberId: string }
  | { kind: "list"; text: string; start: number; end: number; listId: string };

export type ParsedQuickAdd = {
  /** The text with the applied tokens removed and whitespace collapsed; may be "". */
  title: string;
  /** ISO string. Date-only values are UTC midnight of the calendar day (how the list view reads them). */
  dueDate: string | null;
  dueHasTime: boolean;
  priority: 1 | 2 | 3 | 4 | null;
  /** In the order typed, no duplicates. */
  assigneeIds: string[];
  listId: string | null;
  /** The tokens that were applied (and removed from the title), in text order. */
  tokens: QuickAddToken[];
};

export type ParseOptions = {
  members?: QuickAddMember[];
  lists?: QuickAddList[];
  /** Reference time for relative dates; defaults to now. */
  now?: Date;
  /** tokenKey()s to leave as text. */
  ignore?: readonly string[];
};

/** Identifies a token for `ignore`, independent of where it sits in the text. */
export function tokenKey(token: Pick<QuickAddToken, "kind" | "text">): string {
  return `${token.kind}:${token.text.trim().toLowerCase()}`;
}

const HANDLE_CHARS = "[\\p{L}\\p{N}._-]";
const WORD_START = "(?<=^|\\s)";

function squash(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, "");
}

/**
 * What to type after `@` for a member: the first name, lowercased (`@ada`); when another member
 * shares that first name, the full name without spaces (`@adalovelace`). Both forms match.
 */
export function memberHandle(member: QuickAddMember, members: readonly QuickAddMember[]): string {
  const first = squash(member.name.trim().split(/\s+/)[0] ?? "");
  const shared = members.some((m) => m.id !== member.id && squash(m.name.trim().split(/\s+/)[0] ?? "") === first);
  return shared || !first ? squash(member.name) : first;
}

/** What to type after `#` for a list: the name lowercased with spaces as dashes (`#design-review`). */
export function listHandle(list: QuickAddList): string {
  return list.name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "");
}

function findMember(handle: string, members: readonly QuickAddMember[]): QuickAddMember | undefined {
  const h = handle.toLowerCase();
  return (
    members.find((m) => memberHandle(m, members) === h) ??
    members.find((m) => squash(m.name) === h)
  );
}

function findList(handle: string, lists: readonly QuickAddList[]): QuickAddList | undefined {
  const h = handle.toLowerCase();
  return lists.find((l) => listHandle(l) === h);
}

const PRIORITY_RE = new RegExp(`${WORD_START}[pP]([1-4])(?=\\s|$)`, "gu");
const MENTION_RE = new RegExp(`${WORD_START}([@#])(${HANDLE_CHARS}+)`, "gu");
const PREPOSITION_RE = /(?:^|\s)(?:by|on|at|due|before)\s+$/i;

export function parseQuickAdd(text: string, opts: ParseOptions = {}): ParsedQuickAdd {
  const members = opts.members ?? [];
  const lists = opts.lists ?? [];
  const ignored = new Set(opts.ignore ?? []);
  const skip = (t: Pick<QuickAddToken, "kind" | "text">) => ignored.has(tokenKey(t));

  // 1. Priority, assignee and list tokens.
  let priority: QuickAddToken | undefined;
  let list: QuickAddToken | undefined;
  const assignees: QuickAddToken[] = [];

  for (const m of text.matchAll(PRIORITY_RE)) {
    const token: QuickAddToken = {
      kind: "priority",
      text: m[0],
      start: m.index,
      end: m.index + m[0].length,
      priority: Number(m[1]) as 1 | 2 | 3 | 4,
    };
    if (!priority && !skip(token)) priority = token;
  }

  for (const m of text.matchAll(MENTION_RE)) {
    // A trailing "." or "," is punctuation, not part of the handle ("ask @ada.").
    const handle = m[2].replace(/[._-]+$/, "");
    const raw = m[1] + handle;
    const span = { start: m.index, end: m.index + raw.length };
    if (m[1] === "@") {
      const member = findMember(handle, members);
      if (!member) continue;
      const token: QuickAddToken = { kind: "assignee", text: raw, ...span, memberId: member.id };
      if (skip(token) || assignees.some((a) => a.kind === "assignee" && a.memberId === member.id)) continue;
      assignees.push(token);
    } else {
      const found = findList(handle, lists);
      if (!found) continue;
      const token: QuickAddToken = { kind: "list", text: raw, ...span, listId: found.id };
      if (!list && !skip(token)) list = token;
    }
  }

  const claimed = [priority, list, ...assignees].filter((t): t is QuickAddToken => !!t);

  // 2. Dates, on the text with the claimed tokens blanked out (same length, so offsets hold).
  let masked = text;
  for (const t of claimed) masked = masked.slice(0, t.start) + " ".repeat(t.end - t.start) + masked.slice(t.end);

  let date: QuickAddToken | undefined;
  const now = opts.now ?? new Date();
  for (const r of chrono.casual.parse(masked, now, { forwardDate: true })) {
    const s = r.start;
    const namesDay = s.isCertain("day") || s.isCertain("weekday") || s.isCertain("hour");
    if (!namesDay || r.text.trim().toLowerCase() === "now") continue;

    // Take a preposition that sits right before the date along with it.
    let start = r.index;
    const before = PREPOSITION_RE.exec(masked.slice(0, start));
    if (before) start = before.index + (/^\s/.test(before[0]) ? 1 : 0);
    const end = r.index + r.text.length;

    const hasTime = s.isCertain("hour");
    const dueDate = hasTime
      ? s.date().toISOString()
      : dateOnlyISO(s.get("year") ?? now.getFullYear(), (s.get("month") ?? 1) - 1, s.get("day") ?? 1);
    const token: QuickAddToken = { kind: "date", text: text.slice(start, end), start, end, dueDate, dueHasTime: hasTime };
    // Dismissing "by monday" or just "monday" both stick.
    if (skip(token) || skip({ kind: "date", text: r.text })) continue;
    date = token;
    break;
  }

  const applied = [...claimed, ...(date ? [date] : [])].sort((a, b) => a.start - b.start);

  // 3. Title: the text without the applied tokens.
  let title = "";
  let at = 0;
  for (const t of applied) {
    title += text.slice(at, t.start) + " ";
    at = t.end;
  }
  title += text.slice(at);

  return {
    title: title.replace(/\s+/g, " ").trim(),
    dueDate: date?.kind === "date" ? date.dueDate : null,
    dueHasTime: date?.kind === "date" ? date.dueHasTime : false,
    priority: priority?.kind === "priority" ? priority.priority : null,
    assigneeIds: assignees.flatMap((a) => (a.kind === "assignee" ? [a.memberId] : [])),
    listId: list?.kind === "list" ? list.listId : null,
    tokens: applied,
  };
}

// ---------- Autocomplete ----------

export type ActiveMention = {
  kind: "assignee" | "list";
  /** What's typed after the `@`/`#` up to the caret, lowercased. */
  query: string;
  /** Index of the `@`/`#`. */
  start: number;
  /** End of the word the caret is in. */
  end: number;
};

/** The `@…`/`#…` word the caret is in (or right after), for the suggestion menu; else null. */
export function activeMention(text: string, caret: number): ActiveMention | null {
  const before = text.slice(0, caret);
  const m = new RegExp(`${WORD_START}([@#])(${HANDLE_CHARS}*)$`, "u").exec(before);
  if (!m) return null;
  const rest = new RegExp(`^${HANDLE_CHARS}*`, "u").exec(text.slice(caret))?.[0] ?? "";
  return {
    kind: m[1] === "@" ? "assignee" : "list",
    query: m[2].toLowerCase(),
    start: m.index,
    end: caret + rest.length,
  };
}

/** Replaces the active `@…`/`#…` word with the chosen handle plus a space; returns the new caret. */
export function applyMention(
  text: string,
  mention: ActiveMention,
  handle: string,
): { text: string; caret: number } {
  const sigil = mention.kind === "assignee" ? "@" : "#";
  const after = text.slice(mention.end).replace(/^ /, "");
  const insert = `${sigil}${handle} `;
  return { text: text.slice(0, mention.start) + insert + after, caret: mention.start + insert.length };
}
