"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconDots } from "@tabler/icons-react";
import { toast } from "sonner";
import { ListIcon } from "@/components/list-icon";
import { ListIconGrid } from "@/components/list-icon-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ViewMenu } from "@/components/tasks/view-menu";
import {
  listViewKey,
  useRenameList,
  useSetSubtaskDisplay,
} from "@/hooks/use-list-view";
import type { SortMode } from "@/lib/list-view";
import { updateListAction } from "@/server/actions/lists";
import type { ListViewDTO } from "@/server/services/types";

/** The full-width header band: breadcrumb, inline-renameable list name, View and ⋯ menus. */
export function ListHeader({
  data,
  spaceId,
  canDeleteLists,
  sort,
  showCompleted,
  onSort,
  onShowCompleted,
}: {
  data: ListViewDTO;
  spaceId: string;
  canDeleteLists: boolean;
  sort: SortMode;
  showCompleted: boolean;
  onSort: (sort: SortMode) => void;
  onShowCompleted: (show: boolean) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const rename = useRenameList(data.list.id);
  const setSubtaskDisplay = useSetSubtaskDisplay(data.list.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.list.name);
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const escaped = useRef(false);

  function startRename() {
    setDraft(data.list.name);
    escaped.current = false;
    setEditing(true);
  }

  function saveRename() {
    setEditing(false);
    const name = draft.trim();
    if (!name || name === data.list.name) return;
    rename.mutate({ name });
  }

  async function onIconChange(icon: string | null) {
    setPickerOpen(false);
    qc.setQueryData<ListViewDTO>(listViewKey(data.list.id), (d) =>
      d ? { ...d, list: { ...d.list, icon } } : d,
    );
    const res = await updateListAction({ listId: data.list.id, icon });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    router.refresh();
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  const n = data.tasks.length;
  const m = data.statuses.length;

  return (
    <header className="w-full border-b border-border bg-sidebar/50 pb-4">
      <div className="mx-auto w-full max-w-[880px] px-4 pt-5 md:px-6">
        <div className="flex h-5 items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: data.project.color }}
          />
          <Link
            href={`/s/${spaceId}/p/${data.project.id}`}
            className="text-[13px] text-muted-foreground hover:underline"
          >
            {data.project.name}
          </Link>
          <span className="grow" />
          <button
            type="button"
            onClick={() => void share()}
            className="text-[13px] font-medium text-foreground/80"
          >
            {copied ? "Copied" : "Share"}
          </button>
        </div>

        <div className="mt-2 flex h-11 items-center">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="List icon"
                  title="Change icon"
                  className="mr-2 flex shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                />
              }
            >
              <ListIcon icon={data.list.icon} className="size-5" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-fit">
              <ListIconGrid
                value={data.list.icon}
                onSelect={(icon) => void onIconChange(icon)}
              />
            </PopoverContent>
          </Popover>
          <div className="min-w-0 grow">
            {editing ? (
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setEditing(false);
                    saveRename();
                  } else if (e.key === "Escape") {
                    escaped.current = true;
                    setEditing(false);
                  }
                }}
                onBlur={() => {
                  if (escaped.current) {
                    escaped.current = false;
                    return;
                  }
                  saveRename();
                }}
                aria-label="List name"
                className="h-11 border-0 px-0 text-[28px] font-semibold tracking-[-0.02em] focus-visible:ring-1"
              />
            ) : (
              <h1 className="min-w-0">
                <button
                  type="button"
                  onClick={startRename}
                  title="Rename list"
                  className="block max-w-full truncate text-left text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-foreground"
                >
                  {data.list.name}
                </button>
              </h1>
            )}
          </div>
          <ViewMenu
            mode={data.list.subtaskDisplay}
            sort={sort}
            showCompleted={showCompleted}
            onMode={(mode) => setSubtaskDisplay.mutate({ subtaskDisplay: mode })}
            onSort={onSort}
            onShowCompleted={onShowCompleted}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  aria-label="List options"
                  className="size-[30px] shrink-0 p-0 text-muted-foreground hover:bg-sidebar"
                />
              }
            >
              <IconDots className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={startRename}>Rename list</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPickerOpen(true)}>
                  Change icon
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/s/${spaceId}/p/${data.project.id}/settings`)
                  }
                >
                  Project settings
                </DropdownMenuItem>
                {canDeleteLists && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        router.push(`/s/${spaceId}/p/${data.project.id}/settings`)
                      }
                    >
                      Delete list…
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {n} task{n === 1 ? "" : "s"} · {m} status{m === 1 ? "" : "es"}
        </p>
      </div>
    </header>
  );
}
