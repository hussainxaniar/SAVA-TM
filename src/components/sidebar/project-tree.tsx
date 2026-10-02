"use client";

import { useId, useRef, useState, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconFilePlus,
  IconFileText,
  IconList,
} from "@tabler/icons-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS } from "@/lib/project-colors";
import {
  archiveDocAction,
  createDocAction,
  renameDocAction,
} from "@/server/actions/docs";
import {
  archiveProjectAction,
  reorderProjectAction,
  updateProjectAction,
} from "@/server/actions/projects";
import { updateProjectSchema } from "@/server/actions/projects.schema";
import { useSidebarDropTarget } from "@/hooks/use-sidebar-drop";
import type { SidebarDTO } from "@/server/services/types";

export type ProjectTreeProps = {
  spaceId: string;
  projects: SidebarDTO["projects"];
  canArchiveProjects: boolean;
};

const COLLAPSED_KEY = "sava.sidebar.collapsed";

/**
 * Collapsed-project ids live in localStorage, read via useSyncExternalStore so the
 * first client render stays hydration-safe (server snapshot: nothing collapsed) and
 * toggles in this tab re-render without setState-in-effect.
 */
const collapsedStore = (() => {
  let listeners: (() => void)[] = [];
  return {
    read(): string | null {
      try {
        return window.localStorage.getItem(COLLAPSED_KEY);
      } catch {
        return null;
      }
    },
    readServer(): string | null {
      return null;
    },
    write(ids: string[]) {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids));
      } catch {
        // storage full or blocked — collapse still works for this session
      }
    },
    subscribe(listener: () => void) {
      listeners = [...listeners, listener];
      window.addEventListener("storage", listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
        window.removeEventListener("storage", listener);
      };
    },
    emit() {
      for (const listener of listeners) listener();
    },
  };
})();

const listRow =
  "flex h-8 items-center gap-2 rounded-md pl-9 pr-2 text-sm text-foreground/80 hover:bg-sidebar-accent";
const listRowActive =
  "bg-selected font-medium text-selected-foreground hover:bg-selected";

type SidebarProject = SidebarDTO["projects"][number];
type SidebarDoc = SidebarProject["docs"][number];

function DocRow({
  spaceId,
  projectId,
  doc,
}: {
  spaceId: string;
  projectId: string;
  doc: SidebarDoc;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.title);
  const cancelled = useRef(false);

  const active = pathname.startsWith(
    `/s/${spaceId}/p/${projectId}/d/${doc.id}`,
  );

  function startRename() {
    cancelled.current = false;
    setDraft(doc.title);
    setEditing(true);
  }

  async function saveRename() {
    setEditing(false);
    const trimmed = draft.trim();
    // Empty or unchanged titles cancel the rename instead of hitting the action.
    if (!trimmed || trimmed === doc.title) return;
    const res = await renameDocAction({ docId: doc.id, title: trimmed });
    if (!res.ok) toast.error(res.error.message);
  }

  async function onArchive() {
    const res = await archiveDocAction({ docId: doc.id });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast(`Archived "${doc.title}"`);
    if (pathname.includes(`/d/${doc.id}/`)) {
      router.push(`/s/${spaceId}/p/${projectId}`);
    }
  }

  return (
    <div className={cn(listRow, "group", active && listRowActive)}>
      {editing ? (
        <Input
          value={draft}
          autoFocus
          onFocus={(e) => e.target.select()}
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
          className="h-7 my-0.5 text-sm"
        />
      ) : (
        <>
          {doc.firstPageId ? (
            <Link
              href={`/s/${spaceId}/p/${projectId}/d/${doc.id}/${doc.firstPageId}`}
              className="flex min-w-0 grow items-center gap-2"
            >
              <IconFileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{doc.title}</span>
            </Link>
          ) : (
            <>
              <IconFileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="grow truncate">{doc.title}</span>
            </>
          )}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${doc.title} options`}
                  className={cn(
                    "shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100",
                    menuOpen && "opacity-100",
                  )}
                />
              }
            >
              <IconDots />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={startRename}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void onArchive()}
                >
                  Archive
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

function ProjectRow({
  spaceId,
  project,
  expanded,
  onToggle,
  canArchiveProjects,
  isFirst,
}: {
  spaceId: string;
  project: SidebarProject;
  expanded: boolean;
  onToggle: (id: string) => void;
  canArchiveProjects: boolean;
  isFirst: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // While a task row is dragged over a list of this project (list view), the row lights up.
  const dropTarget = useSidebarDropTarget();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const cancelled = useRef(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  const projectHref = `/s/${spaceId}/p/${project.id}`;

  function startRename() {
    cancelled.current = false;
    setDraft(project.name);
    setEditing(true);
  }

  async function saveRename() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === project.name) return;
    const parsed = updateProjectSchema.safeParse({
      projectId: project.id,
      name: trimmed,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }
    const res = await updateProjectAction(parsed.data);
    if (!res.ok) toast.error(res.error.message);
  }

  async function setColor(value: string) {
    const res = await updateProjectAction({
      projectId: project.id,
      color: value,
    });
    if (!res.ok) toast.error(res.error.message);
  }

  async function onArchive() {
    setArchivePending(true);
    const res = await archiveProjectAction({ projectId: project.id });
    setArchivePending(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setArchiveOpen(false);
    if (pathname.startsWith(projectHref)) router.push(`/s/${spaceId}`);
  }

  async function onNewDoc() {
    const res = await createDocAction({ projectId: project.id });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    router.push(
      `/s/${spaceId}/p/${project.id}/d/${res.data.docId}/${res.data.firstPageId}`,
    );
  }

  return (
    // The sortable node wraps the header AND its lists/docs, so they move together.
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
      className={cn(isDragging && "relative z-10 opacity-50", !isFirst && "mt-1")}
    >
      <div
        className={cn(
          "group relative flex h-8 items-center gap-1.5 rounded-md pl-1 pr-2 hover:bg-sidebar-accent",
          isDragging && "cursor-grabbing",
        )}
        // The whole project row drags (a 4px move starts it, so clicks still work); the
        // sortable wrapper above keeps the header and its lists/docs moving together.
        {...attributes}
        {...listeners}
      >
        {editing ? (
          <Input
            value={draft}
            autoFocus
            onFocus={(e) => e.target.select()}
            // Keep text selection usable: a drag never starts from inside the rename input.
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
            className="h-7 my-0.5 text-sm"
          />
        ) : (
          <>
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`Toggle ${project.name}`}
              onClick={() => onToggle(project.id)}
              className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground"
            >
              {expanded ? (
                <IconChevronDown className="size-3.5" strokeWidth={2.4} />
              ) : (
                <IconChevronRight className="size-3.5" strokeWidth={2.4} />
              )}
            </button>
            <Link
              href={projectHref}
              className="flex h-8 min-w-0 grow items-center gap-1.5 text-sm font-medium text-foreground"
            >
              {project.icon ? (
                <span className="mx-1 shrink-0 text-sm">{project.icon}</span>
              ) : (
                <span
                  className="mx-1 size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: project.color }}
                />
              )}
              <span className="truncate">{project.name}</span>
            </Link>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${project.name} options`}
                    className={cn(
                      "shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100",
                      menuOpen && "opacity-100",
                    )}
                  />
                }
              >
                <IconDots />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => void onNewDoc()}
                  >
                    <IconFilePlus />
                    New doc
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={startRename}>
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Color</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuGroup>
                        {PROJECT_COLORS.map((c) => (
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
                            {project.color === c.value && (
                              <IconCheck className="ml-auto" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    onClick={() => router.push(`${projectHref}/settings`)}
                  >
                    Project settings
                  </DropdownMenuItem>
                  {canArchiveProjects && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setArchiveOpen(true)}
                      >
                        Archive project
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      {expanded && !editing && (
        <>
          {project.lists.map((list) => {
            const href = `/s/${spaceId}/p/${project.id}/l/${list.id}`;
            const active = pathname.startsWith(href);
            // A dragged row hovers this list: highlight instead of the count (6.5/6.6).
            const targeted = dropTarget?.listId === list.id;
            return (
              <Link
                key={list.id}
                href={href}
                data-drop-list-id={list.id}
                className={cn(
                  listRow,
                  active && listRowActive,
                  targeted && "bg-selected text-selected-foreground ring-1 ring-primary/40 hover:bg-selected",
                )}
              >
                <IconList
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground",
                    (active || targeted) && "text-selected-foreground",
                  )}
                />
                <span className="grow truncate">{list.name}</span>
                {targeted ? (
                  <span className="shrink-0 text-[11px] font-medium text-selected-foreground">
                    {dropTarget?.mode === "add" ? "Add here" : "Move here"}
                  </span>
                ) : (
                  list.openTaskCount > 0 && (
                    <span
                      className={cn(
                        "shrink-0 text-xs text-muted-foreground",
                        active && "text-selected-foreground",
                      )}
                    >
                      {list.openTaskCount}
                    </span>
                  )
                )}
              </Link>
            );
          })}
          {project.docs.map((doc) => (
            <DocRow
              key={doc.id}
              spaceId={spaceId}
              projectId={project.id}
              doc={doc}
            />
          ))}
        </>
      )}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the sidebar for everyone. Nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={archivePending}
              onClick={(e) => {
                e.preventDefault();
                void onArchive();
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ProjectTree({
  spaceId,
  projects,
  canArchiveProjects,
}: ProjectTreeProps) {
  const [items, setItems] = useState(projects);
  const [prev, setPrev] = useState(projects);
  if (projects !== prev) {
    setPrev(projects);
    setItems(projects);
  }
  const raw = useSyncExternalStore(
    collapsedStore.subscribe,
    collapsedStore.read,
    collapsedStore.readServer,
  );
  const collapsed = useMemo(() => {
    try {
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  function onToggle(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsedStore.write([...next]);
    collapsedStore.emit();
  }

  // Stable id: without it dnd-kit numbers its aria ids with a global counter, which differs
  // between the server and client renders (hydration mismatch).
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((p) => p.id === active.id);
    const to = items.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(items, from, to);
    setItems(next);
    const i = next.findIndex((p) => p.id === active.id);
    void (async () => {
      const res = await reorderProjectAction({
        projectId: String(active.id),
        beforeId: next[i - 1]?.id ?? null,
        afterId: next[i + 1]?.id ?? null,
      });
      if (!res.ok) {
        setItems(projects);
        toast.error(res.error.message);
      }
    })();
  }

  if (items.length === 0) {
    return (
      <p className="px-2 text-sm text-muted-foreground">No projects yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-px">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((project, index) => (
            <ProjectRow
              key={project.id}
              spaceId={spaceId}
              project={project}
              expanded={!collapsed.has(project.id)}
              onToggle={onToggle}
              canArchiveProjects={canArchiveProjects}
              isFirst={index === 0}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
