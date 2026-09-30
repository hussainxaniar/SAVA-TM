"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { IconHash, IconTrash } from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createListAction, deleteListAction, reorderListAction, updateListAction } from "@/server/actions/lists";
import {
  createListSchema,
  deleteListSchema,
  updateListSchema,
} from "@/server/actions/lists.schema";
import type { ProjectSettingsDTO } from "@/server/services/types";
import { SortableRow, SortableRows } from "./sortable-rows";

export type ListsEditorProps = {
  spaceId: string;
  projectId: string;
  lists: ProjectSettingsDTO["lists"];
  /** Owner/Admin may delete lists; everyone may create, rename and reorder. */
  canDelete: boolean;
};

type ListRow = ProjectSettingsDTO["lists"][number];

function taskLabel(count: number) {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

function ListRowItem({
  list,
  others,
  canDelete,
  onlyList,
}: {
  list: ListRow;
  others: ListRow[];
  canDelete: boolean;
  /** The server rejects deleting a project's last list; the UI says why up front. */
  onlyList: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.name);
  const cancelled = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [targetListId, setTargetListId] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  function startRename() {
    cancelled.current = false;
    setDraft(list.name);
    setEditing(true);
  }

  async function saveRename() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === list.name) return;
    const parsed = updateListSchema.safeParse({ listId: list.id, name: trimmed });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }
    const res = await updateListAction(parsed.data);
    if (!res.ok) toast.error(res.error.message);
  }

  function openDelete() {
    setDeleteError(null);
    setTargetListId(others[0]?.id ?? "");
    setDeleteOpen(true);
  }

  async function onDelete() {
    const parsed = deleteListSchema.safeParse({
      listId: list.id,
      targetListId,
    });
    if (!parsed.success) {
      setDeleteError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setDeletePending(true);
    setDeleteError(null);
    const res = await deleteListAction(parsed.data);
    setDeletePending(false);
    if (!res.ok) {
      setDeleteError(res.error.message);
      return;
    }
    setDeleteOpen(false);
  }

  return (
    <SortableRow id={list.id}>
      <IconHash className="size-4 shrink-0 text-muted-foreground" />
      {editing ? (
        <Input
          value={draft}
          autoFocus
          onFocus={(e) => e.target.select()}
          // The row drags from anywhere; keep text selection working inside the input.
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void saveRename();
            } else if (e.key === "Escape") {
              cancelled.current = true;
              setEditing(false);
            }
          }}
          onBlur={() => {
            if (cancelled.current) {
              cancelled.current = false;
              return;
            }
            void saveRename();
          }}
          className="max-w-sm"
        />
      ) : (
        <button
          type="button"
          onClick={startRename}
          className="min-w-0 grow truncate text-left text-sm hover:underline"
        >
          {list.name}
        </button>
      )}
      <span className="text-xs text-muted-foreground">{taskLabel(list.taskCount)}</span>
      {canDelete && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${list.name}`}
            title={onlyList ? "A project needs at least one list" : undefined}
            disabled={onlyList}
            className="text-muted-foreground"
            onClick={openDelete}
          >
            <IconTrash />
          </Button>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {list.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {list.taskCount > 0
                    ? "Its tasks, with their subtasks, will move to the list you pick. Tasks that were only linked here stay in their own lists."
                    : "It has no tasks."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label>Move tasks to</Label>
                <Select
                  items={Object.fromEntries(others.map((o) => [o.id, o.name]))}
                  value={targetListId}
                  onValueChange={(value) => value && setTargetListId(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {others.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {deleteError && (
                <p role="alert" className="text-sm text-destructive">
                  {deleteError}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deletePending}
                  onClick={(e) => {
                    e.preventDefault();
                    void onDelete();
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </SortableRow>
  );
}

export function ListsEditor({ projectId, lists, canDelete }: ListsEditorProps) {
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addPending, setAddPending] = useState(false);

  async function onReorder(
    movedId: string,
    beforeId: string | null,
    afterId: string | null,
  ) {
    const res = await reorderListAction({ listId: movedId, beforeId, afterId });
    if (!res.ok) {
      toast.error(res.error.message);
      return false;
    }
    return true;
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = createListSchema.safeParse({ projectId, name: newName });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setAddPending(true);
    setAddError(null);
    const res = await createListAction(parsed.data);
    setAddPending(false);
    if (!res.ok) {
      setAddError(res.error.message);
      return;
    }
    setNewName("");
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Lists</h2>
      <p className="text-sm text-muted-foreground">
        A project always has at least one list.
      </p>
      <SortableRows items={lists} onReorder={onReorder}>
        {(items) =>
          items.map((list) => (
            <ListRowItem
              key={list.id}
              list={list}
              others={lists.filter((o) => o.id !== list.id)}
              canDelete={canDelete}
              onlyList={lists.length === 1}
            />
          ))
        }
      </SortableRows>
      <form onSubmit={onAdd} className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New list"
            maxLength={80}
            aria-label="New list"
            className="max-w-sm"
          />
          <Button type="submit" disabled={addPending}>
            Add
          </Button>
        </div>
        {addError && (
          <p role="alert" className="text-sm text-destructive">
            {addError}
          </p>
        )}
      </form>
    </section>
  );
}
