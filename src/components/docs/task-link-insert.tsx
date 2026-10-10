"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { IconSubtask } from "@tabler/icons-react";
import { StatusGlyph } from "@/components/tasks/status-icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SLASH_LINK_TASK_EVENT } from "@/components/rich-text/slash/slash-command";
import { useTaskSearch } from "@/hooks/use-task-links";

/*
 * The "Link task" button above the page body (Section 11.4): a popover with a search box over the
 * space's tasks (Enter picks the first result, Esc closes) that inserts a taskLink chip at the
 * cursor followed by a space. Keydowns stop at the popover so the editor never sees the typing.
 */
export function TaskLinkInsert({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useTaskSearch(query, open);

  // The "/" menu's Link task item opens this same search.
  useEffect(() => {
    const openSearch = () => setOpen(true);
    window.addEventListener(SLASH_LINK_TASK_EVENT, openSearch);
    return () => window.removeEventListener(SLASH_LINK_TASK_EVENT, openSearch);
  }, []);

  const pick = (task: { id: string; title: string }) => {
    editor
      .chain()
      .focus()
      .insertContent([
        { type: "taskLink", attrs: { taskId: task.id, title: task.title } },
        { type: "text", text: " " },
      ])
      .run();
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" type="button">
            <IconSubtask className="size-3.5" />
            Link task
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-80 p-1"
        // After a pick the cursor stays in the page, right after the chip (closing would otherwise return focus to the button).
        finalFocus={false}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results && results.length > 0) {
                e.preventDefault();
                pick(results[0]);
              }
            }}
            autoFocus
            placeholder="Search tasks"
            className="w-full bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          {isLoading ? (
            <p className="px-1.5 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : !results || results.length === 0 ? (
            <p className="px-1.5 py-2 text-sm text-muted-foreground">No tasks found</p>
          ) : (
            <div className="flex flex-col">
              {results.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => pick(task)}
                  className="flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent"
                >
                  <StatusGlyph status={task.status} statuses={[task.status]} size={13} />
                  <span className="min-w-0 flex-1 truncate text-left">{task.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
