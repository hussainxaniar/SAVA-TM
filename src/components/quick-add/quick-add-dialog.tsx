"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { IconCalendar, IconCheck, IconChevronDown, IconList, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import {
  activeMention,
  applyMention,
  listHandle,
  memberHandle,
  parseQuickAdd,
  tokenKey,
  type QuickAddToken,
} from "@/lib/quick-add-parser";
import { formatDue, type DueTone } from "@/lib/list-view";
import { QUICK_ADD_EVENT } from "@/lib/quick-add";
import { readLastList, rememberLastList } from "@/lib/last-list";
import { useCreateTask } from "@/hooks/use-list-view";
import { Avatar } from "@/components/tasks/avatar-stack";
import { PriorityFlag } from "@/components/tasks/priority-flag";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SidebarDTO, UserLite } from "@/server/services/types";

export type QuickAddDialogProps = {
  spaceId: string;
  /** The sidebar tree: every active project with its lists, in position order. */
  projects: SidebarDTO["projects"];
  /** Space members, for `@` autocomplete and assignee chips. */
  members: UserLite[];
};

/** One `@`/`#` autocomplete row, normalized so one template renders both kinds. */
type Suggestion = { id: string; name: string; sigil: string; handle: string };

type ListEntry = {
  projectId: string;
  projectName: string;
  projectColor: string;
  listId: string;
  listName: string;
};

const TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-overdue",
  today: "text-success",
  default: "",
};

/**
 * Section 9.3 quick add: one input, parsed chips, `@`/`#` autocomplete, a list picker and an
 * optimistic save. Mounted once per space shell; only the popup renders while open.
 */
export function QuickAddDialog({ spaceId, projects, members }: QuickAddDialogProps) {
  const router = useRouter();
  const params = useParams<Record<string, string | string[] | undefined>>();
  const paramId = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const routeProjectId = paramId(params.projectId);
  const routeListId = paramId(params.listId);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  /** tokenKey()s the user dismissed with a chip × — those stay as plain title text. */
  const [dismissed, setDismissed] = useState<string[]>([]);
  /** The list picked in the footer picker; wins over the route and the last used list. */
  const [pickedListId, setPickedListId] = useState<string | null>(null);
  const [lastListId, setLastListId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  /** The `@`/`#` word Esc hid, until the caret leaves it. */
  const [hiddenStart, setHiddenStart] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Every list as { project, list } so the picker, the parser targets and the toast URL line up.
  const entries = useMemo(
    () =>
      projects.flatMap<ListEntry>((p) =>
        p.lists.map((l) => ({
          projectId: p.id,
          projectName: p.name,
          projectColor: p.color,
          listId: l.id,
          listName: l.name,
        })),
      ),
    [projects],
  );
  const entryOf = useCallback(
    (id: string | null | undefined) => (id ? entries.find((e) => e.listId === id) : undefined),
    [entries],
  );

  // ---------- opening and closing ----------

  // The last used list is read when the dialog opens, never during render.
  const openDialog = useCallback(() => {
    setLastListId(readLastList(spaceId));
    setOpen(true);
  }, [spaceId]);

  // `q` anywhere in the space, except while typing or with a dialog already open (9.7).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "q" && e.key !== "Q") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      openDialog();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDialog]);

  // The sidebar's "Add task" button.
  useEffect(() => {
    window.addEventListener(QUICK_ADD_EVENT, openDialog);
    return () => window.removeEventListener(QUICK_ADD_EVENT, openDialog);
  }, [openDialog]);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setText("");
      setCaret(0);
      setDismissed([]);
      setPickedListId(null);
      setHiddenStart(null);
      setHighlight(0);
    }
  }, []);

  // ---------- target list and parse ----------

  const baseEntry = useMemo(() => {
    const picked = entryOf(pickedListId);
    if (picked) return picked;
    const routeList = entryOf(routeListId);
    if (routeList) return routeList;
    const routeProject = projects.find((p) => p.id === routeProjectId);
    if (routeProject?.lists.length) {
      const l = routeProject.lists[0];
      return {
        projectId: routeProject.id,
        projectName: routeProject.name,
        projectColor: routeProject.color,
        listId: l.id,
        listName: l.name,
      };
    }
    const last = entryOf(lastListId);
    if (last) return last;
    const withLists = projects.find((p) => p.lists.length > 0);
    if (!withLists) return undefined;
    const l = withLists.lists[0];
    return {
      projectId: withLists.id,
      projectName: withLists.name,
      projectColor: withLists.color,
      listId: l.id,
      listName: l.name,
    };
  }, [entryOf, lastListId, pickedListId, projects, routeListId, routeProjectId]);

  // `#list` tokens resolve against the base list's project.
  const baseProject = useMemo(
    () => projects.find((p) => p.id === baseEntry?.projectId),
    [projects, baseEntry],
  );
  const parseLists = useMemo(() => baseProject?.lists ?? [], [baseProject]);

  const parsed = useMemo(
    () => parseQuickAdd(text, { members, lists: parseLists, ignore: dismissed }),
    [text, members, parseLists, dismissed],
  );
  const finalEntry = entryOf(parsed.listId) ?? baseEntry;

  // ---------- autocomplete ----------

  const mention = activeMention(text, caret);
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!mention || mention.start === hiddenStart) return [];
    const q = mention.query;
    const items: Suggestion[] = mention.kind === "assignee"
      ? members
          .filter(
            (m) => memberHandle(m, members).startsWith(q) || m.name.toLowerCase().includes(q),
          )
          .slice(0, 6)
          .map((m) => ({ id: m.id, name: m.name, sigil: "@", handle: memberHandle(m, members) }))
      : parseLists
          .filter((l) => listHandle(l).startsWith(q) || l.name.toLowerCase().includes(q))
          .slice(0, 6)
          .map((l) => ({ id: l.id, name: l.name, sigil: "#", handle: listHandle(l) }));
    // A word that already names a handle is resolved (it shows as a chip): hide the list so
    // Enter saves instead of re-picking it.
    return items.some((item) => item.handle === q) ? [] : items;
  }, [mention, members, parseLists, hiddenStart]);
  const suggestionsVisible = suggestions.length > 0;
  // Clamped to the current set: typing can shrink the matches under the highlight.
  const activeHighlight = suggestions.length ? Math.min(highlight, suggestions.length - 1) : 0;

  const pick = useCallback(
    (index: number) => {
      if (!mention) return;
      const item = suggestions[index];
      if (!item) return;
      const next = applyMention(text, mention, item.handle);
      setText(next.text);
      setCaret(next.caret);
      setHiddenStart(null);
      setHighlight(0);
    },
    [mention, suggestions, text],
  );

  // Keep the caret where applyMention left it after the input re-renders.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && el === document.activeElement) el.setSelectionRange(caret, caret);
  }, [caret, text]);

  // ---------- saving ----------

  const createTask = useCreateTask(finalEntry?.listId ?? "");
  const canSave = parsed.title !== "" && finalEntry !== undefined;

  const save = useCallback(async () => {
    if (!finalEntry || !parsed.title) return;
    const { listId, projectId, listName } = finalEntry;
    const input = {
      tempId: `temp-${crypto.randomUUID()}`,
      listId,
      title: parsed.title,
      priority: parsed.priority ?? undefined,
      dueDate: parsed.dueDate ?? undefined,
      dueHasTime: parsed.dueHasTime,
      assigneeIds: parsed.assigneeIds,
    };
    try {
      const pending = createTask.mutateAsync(input);
      // Close (and reset) once the mutation holds its own copy of the target list: optimistic,
      // the row shows up the moment that list is on screen.
      onOpenChange(false);
      const row = await pending;
      rememberLastList(spaceId, listId);
      router.refresh(); // sidebar open-task counts
      toast.success(`Added to ${listName}`, {
        action: {
          label: "Open",
          onClick: () =>
            router.push(`/s/${spaceId}/p/${projectId}/l/${listId}?task=${row.id}`),
        },
      });
    } catch {
      // The hook already rolled back and showed the error toast.
    }
  }, [createTask, finalEntry, onOpenChange, parsed, router, spaceId]);

  // ---------- input events ----------

  /**
   * Called on every caret move (change, click, keyup, select): tracks the caret, un-hides a
   * word's suggestions once the caret leaves it, and restarts the highlight on a new word.
   */
  function moveCaret(nextText: string, nextCaret: number) {
    const m = activeMention(nextText, nextCaret);
    setHiddenStart((h) => (h !== null && m?.start !== h ? null : h));
    if (m?.start !== mention?.start || m?.query !== mention?.query) setHighlight(0);
    setCaret(nextCaret);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestionsVisible) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(activeHighlight);
        return;
      }
      if (e.key === "Escape") {
        // Hide the suggestions without closing the dialog.
        e.preventDefault();
        e.stopPropagation();
        if (mention) setHiddenStart(mention.start);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    }
  }

  // ---------- render ----------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">Quick add</DialogTitle>
        <input
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            moveCaret(v, e.currentTarget.selectionStart ?? 0);
          }}
          onKeyDown={onInputKeyDown}
          onClick={(e) => moveCaret(text, e.currentTarget.selectionStart ?? 0)}
          onKeyUp={(e) => moveCaret(text, e.currentTarget.selectionStart ?? 0)}
          onSelect={(e) => moveCaret(text, e.currentTarget.selectionStart ?? 0)}
          aria-label="Task name"
          maxLength={500}
          placeholder='Task name — try "Write brief tomorrow p1 @ada #design"'
          className="w-full bg-transparent px-4 pt-4 pb-2 text-[15px] font-medium outline-none placeholder:text-muted-foreground"
        />
        {parsed.tokens.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {parsed.tokens.map((token) => (
              <TokenChip
                key={tokenKey(token)}
                token={token}
                members={members}
                lists={parseLists}
                onDismiss={() =>
                  setDismissed((prev) =>
                    prev.includes(tokenKey(token)) ? prev : [...prev, tokenKey(token)],
                  )
                }
              />
            ))}
          </div>
        )}
        {suggestionsVisible && mention && (
          <div
            role="listbox"
            aria-label={mention.kind === "assignee" ? "Assign to" : "Add to list"}
            className="mx-2 mb-2 rounded-lg border bg-popover p-1"
          >
            {suggestions.map((item, i) => (
              <div
                key={item.id}
                role="option"
                aria-selected={i === activeHighlight}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-2 text-sm",
                  i === activeHighlight && "bg-accent",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
              >
                {mention.kind === "assignee" ? (
                  <Avatar
                    user={members.find((m) => m.id === item.id)!}
                    className="size-5 text-[9px]"
                  />
                ) : (
                  <IconList className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{item.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {item.sigil}
                  {item.handle}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 border-t px-3 py-2">
          {finalEntry ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-w-0 gap-1.5 px-1.5 font-normal text-muted-foreground"
                  />
                }
              >
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: finalEntry.projectColor }}
                />
                <span className="max-w-[280px] truncate">
                  {finalEntry.projectName} / {finalEntry.listName}
                </span>
                <IconChevronDown className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {projects.map((p) => (
                  <DropdownMenuGroup key={p.id}>
                    <DropdownMenuLabel className="truncate">{p.name}</DropdownMenuLabel>
                    {p.lists.map((l) => (
                      <DropdownMenuItem key={l.id} onClick={() => setPickedListId(l.id)}>
                        <IconList className="text-muted-foreground" />
                        <span className="grow truncate">{l.name}</span>
                        {finalEntry.listId === l.id && <IconCheck className="text-muted-foreground" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <p className="px-1 text-sm text-muted-foreground">Create a project first</p>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canSave} onClick={() => void save()}>
              Add task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** One parsed token as a chip; its × keeps the token as plain title text. */
function TokenChip({
  token,
  members,
  lists,
  onDismiss,
}: {
  token: QuickAddToken;
  members: readonly UserLite[];
  lists: readonly { id: string; name: string }[];
  onDismiss: () => void;
}) {
  let content: React.ReactNode;
  if (token.kind === "date") {
    const { label, tone } = formatDue(token.dueDate, token.dueHasTime);
    content = (
      <span className={cn("inline-flex items-center gap-1", TONE_CLASS[tone])}>
        <IconCalendar className="size-3.5" />
        {label}
      </span>
    );
  } else if (token.kind === "priority") {
    content = (
      <>
        <PriorityFlag priority={token.priority} />
        P{token.priority}
      </>
    );
  } else if (token.kind === "assignee") {
    const member = members.find((m) => m.id === token.memberId);
    content = (
      <>
        {member && <Avatar user={member} className="size-4 text-[8px]" />}
        {member?.name ?? "?"}
      </>
    );
  } else {
    const list = lists.find((l) => l.id === token.listId);
    content = (
      <>
        <IconList className="size-3.5" />
        {list?.name ?? "?"}
      </>
    );
  }
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md bg-pill pl-1.5 pr-1 text-xs font-medium">
      {content}
      <button
        type="button"
        aria-label={`Keep "${token.text}" as text`}
        onClick={onDismiss}
        className="flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
      >
        <IconX className="size-3" />
      </button>
    </span>
  );
}
