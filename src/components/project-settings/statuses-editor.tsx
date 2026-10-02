"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { IconCheck, IconTrash } from "@tabler/icons-react";
import { StatusGlyph, statusGlyphKind } from "@/components/tasks/status-icon";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_ICON_KEYS, isStatusIconKey, type StatusIconKey } from "@/lib/list-icons";
import { STATUS_CATEGORY_LABELS, STATUS_COLORS } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import {
  createStatusAction,
  deleteStatusAction,
  reorderStatusAction,
  updateStatusAction,
} from "@/server/actions/statuses";
import {
  createStatusSchema,
  deleteStatusSchema,
  updateStatusSchema,
} from "@/server/actions/statuses.schema";
import type { ProjectSettingsDTO } from "@/server/services/types";
import { SortableRow, SortableRows } from "./sortable-rows";

export type StatusesEditorProps = {
  projectId: string;
  statuses: ProjectSettingsDTO["statuses"];
  /** Owner/Admin. Members see a read-only list. */
  canEdit: boolean;
};

type StatusRow = ProjectSettingsDTO["statuses"][number];

type Category = keyof typeof STATUS_CATEGORY_LABELS;

function taskLabel(count: number) {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

const STATUS_ICON_LABELS: Record<StatusIconKey, string> = {
  circle: "Circle",
  quarter: "Quarter",
  half: "Half",
  threeQuarter: "Three quarters",
};

/** The key matching what an ACTIVE status with no chosen icon shows (its by-position glyph). */
function fallbackIconKey(status: StatusRow, all: readonly StatusRow[]): StatusIconKey {
  switch (statusGlyphKind({ ...status, icon: null }, all)) {
    case "quarter":
      return "quarter";
    case "half":
      return "half";
    case "threeQuarter":
      return "threeQuarter";
    default:
      return "circle";
  }
}

/** The four fill options an ACTIVE status's glyph can take (6.1); the current one is highlighted. */
function StatusIconOptions({
  current,
  onSelect,
}: {
  current: StatusIconKey | null;
  onSelect: (key: StatusIconKey) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {STATUS_ICON_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          title={STATUS_ICON_LABELS[key]}
          aria-label={STATUS_ICON_LABELS[key]}
          onClick={() => onSelect(key)}
          className={cn(
            "flex size-9 items-center justify-center rounded-md text-status-active hover:bg-muted",
            current === key && "bg-selected hover:bg-selected",
          )}
        >
          <StatusGlyph
            status={{ id: "x", category: "ACTIVE", icon: key }}
            statuses={[]}
            size={20}
          />
        </button>
      ))}
    </div>
  );
}

/** The ACTIVE row's icon picker: the trigger shows the status's glyph, the popup the fill options. */
function StatusIconPicker({ status, all }: { status: StatusRow; all: readonly StatusRow[] }) {
  const [open, setOpen] = useState(false);

  async function setIcon(key: StatusIconKey) {
    setOpen(false);
    const res = await updateStatusAction({ statusId: status.id, icon: key });
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Status icon"
            className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-muted"
          />
        }
      >
        <StatusGlyph status={status} statuses={all} size={18} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-fit">
        <StatusIconOptions
          current={
            status.icon && isStatusIconKey(status.icon)
              ? status.icon
              : fallbackIconKey(status, all)
          }
          onSelect={(key) => void setIcon(key)}
        />
      </PopoverContent>
    </Popover>
  );
}

function StatusRowItem({
  status,
  others,
  allStatuses,
}: {
  status: StatusRow;
  others: StatusRow[];
  allStatuses: StatusRow[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(status.name);
  const cancelled = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [replacementId, setReplacementId] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  function startRename() {
    cancelled.current = false;
    setDraft(status.name);
    setEditing(true);
  }

  async function saveRename() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === status.name) return;
    const parsed = updateStatusSchema.safeParse({
      statusId: status.id,
      name: trimmed,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }
    const res = await updateStatusAction(parsed.data);
    if (!res.ok) toast.error(res.error.message);
  }

  async function setColor(value: string) {
    const res = await updateStatusAction({ statusId: status.id, color: value });
    if (!res.ok) toast.error(res.error.message);
  }

  async function onCategoryChange(value: Category | null) {
    if (!value) return;
    const res = await updateStatusAction({ statusId: status.id, category: value });
    // The Select value comes from the prop, so a failure snaps it back.
    if (!res.ok) toast.error(res.error.message);
  }

  function openDelete() {
    setDeleteError(null);
    // The server requires a replacement even when no tasks use this status.
    setReplacementId(
      others.find((o) => o.category === status.category)?.id ?? others[0]?.id ?? "",
    );
    setDeleteOpen(true);
  }

  async function onDelete() {
    const parsed = deleteStatusSchema.safeParse({
      statusId: status.id,
      replacementStatusId: replacementId,
    });
    if (!parsed.success) {
      setDeleteError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setDeletePending(true);
    setDeleteError(null);
    const res = await deleteStatusAction(parsed.data);
    setDeletePending(false);
    if (!res.ok) {
      setDeleteError(res.error.message);
      return;
    }
    setDeleteOpen(false);
  }

  return (
    <SortableRow id={status.id}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Color"
              className="size-4 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
              style={{ backgroundColor: status.color }}
            />
          }
        />
        <DropdownMenuContent>
          <DropdownMenuGroup>
            {STATUS_COLORS.map((c) => (
              <DropdownMenuItem
                key={c.value}
                className="gap-2"
                onClick={() => void setColor(c.value)}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.value }}
                />
                {c.name}
                {status.color === c.value && <IconCheck className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {status.category === "ACTIVE" ? (
        <StatusIconPicker status={status} all={allStatuses} />
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center">
          <StatusGlyph status={status} statuses={allStatuses} size={18} />
        </span>
      )}
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
          {status.name}
        </button>
      )}
      <Select
        items={STATUS_CATEGORY_LABELS}
        value={status.category}
        onValueChange={onCategoryChange}
      >
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(STATUS_CATEGORY_LABELS) as Category[]).map((c) => (
            <SelectItem key={c} value={c}>
              {STATUS_CATEGORY_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">{taskLabel(status.taskCount)}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${status.name}`}
        className="text-muted-foreground"
        onClick={openDelete}
      >
        <IconTrash />
      </Button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {status.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {status.taskCount > 0
                ? `Its ${status.taskCount} task(s) will move to the status you pick.`
                : "No tasks use this status."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Move tasks to</Label>
            <Select
              items={Object.fromEntries(others.map((o) => [o.id, o.name]))}
              value={replacementId}
              onValueChange={(value) => value && setReplacementId(value)}
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
    </SortableRow>
  );
}

export function StatusesEditor({ projectId, statuses, canEdit }: StatusesEditorProps) {
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("ACTIVE");
  const [newIcon, setNewIcon] = useState<StatusIconKey | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addPending, setAddPending] = useState(false);

  async function onReorder(
    movedId: string,
    beforeId: string | null,
    afterId: string | null,
  ) {
    const res = await reorderStatusAction({ statusId: movedId, beforeId, afterId });
    if (!res.ok) {
      toast.error(res.error.message);
      return false;
    }
    return true;
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = createStatusSchema.safeParse({
      projectId,
      name: newName,
      color: STATUS_COLORS[0].value,
      category: newCategory,
      // Only ACTIVE statuses take an icon; the server rejects it on the others.
      icon: newCategory === "ACTIVE" ? newIcon : undefined,
    });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setAddPending(true);
    setAddError(null);
    const res = await createStatusAction(parsed.data);
    setAddPending(false);
    if (!res.ok) {
      setAddError(res.error.message);
      return;
    }
    setNewName("");
    setNewIcon(null);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Statuses</h2>
      <p className="text-sm text-muted-foreground">
        Statuses belong to this project. It always keeps at least one To do and
        one Done status.
      </p>
      {canEdit ? (
        <div className="space-y-4">
          <SortableRows items={statuses} onReorder={onReorder}>
            {(items) =>
              items.map((status) => (
                <StatusRowItem
                  key={status.id}
                  status={status}
                  others={statuses.filter((o) => o.id !== status.id)}
                  allStatuses={items}
                />
              ))
            }
          </SortableRows>
          <form onSubmit={onAdd} className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New status"
                maxLength={40}
                aria-label="New status"
                className="max-w-xs"
              />
              <Select
                items={STATUS_CATEGORY_LABELS}
                value={newCategory}
                onValueChange={(value) => value && setNewCategory(value)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_CATEGORY_LABELS) as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {STATUS_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newCategory === "ACTIVE" && (
                <Popover>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        aria-label="New status icon"
                        className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                      />
                    }
                  >
                    <StatusGlyph
                      status={{ id: "x", category: "ACTIVE", icon: newIcon ?? "circle" }}
                      statuses={[]}
                      size={18}
                    />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-fit">
                    <StatusIconOptions current={newIcon} onSelect={setNewIcon} />
                  </PopoverContent>
                </Popover>
              )}
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
        </div>
      ) : (
        <div className="space-y-4">
          <div className="divide-y rounded-lg border">
            {statuses.map((status) => (
              <div key={status.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-sm">{status.name}</span>
                <Badge variant="secondary">
                  {STATUS_CATEGORY_LABELS[status.category]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {taskLabel(status.taskCount)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Only Owners and Admins can edit statuses.
          </p>
        </div>
      )}
    </section>
  );
}
