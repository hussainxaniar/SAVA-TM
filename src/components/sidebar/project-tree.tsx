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
  Check,
  ChevronRight,
  FileText,
  GripVertical,
  Hash,
  MoreHorizontal,
} from "lucide-react";
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
  archiveProjectAction,
  reorderProjectAction,
  updateProjectAction,
} from "@/server/actions/projects";
import { updateProjectSchema } from "@/server/actions/projects.schema";
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

const childRow =
  "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground";
const childRowActive = "bg-accent font-medium text-foreground";

type SidebarProject = SidebarDTO["projects"][number];

function ProjectRow({
  spaceId,
  project,
  expanded,
  onToggle,
  canArchiveProjects,
}: {
  spaceId: string;
  project: SidebarProject;
  expanded: boolean;
  onToggle: (id: string) => void;
  canArchiveProjects: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
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
  const projectActive = pathname.startsWith(projectHref);

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
      className={cn(isDragging && "relative z-10 opacity-50")}
    >
      <div className="group relative flex items-center gap-1">
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
            <button
              type="button"
              aria-label={`Reorder ${project.name}`}
              className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" />
            </button>
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`Toggle ${project.name}`}
              onClick={() => onToggle(project.id)}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  expanded && "rotate-90",
                )}
              />
            </button>
            <Link
              href={projectHref}
              className={cn(
                "flex h-8 min-w-0 grow items-center gap-2 rounded-md px-2 text-sm hover:bg-accent",
                projectActive
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {project.icon ? (
                <span className="shrink-0 text-sm">{project.icon}</span>
              ) : (
                <span
                  className="size-2.5 shrink-0 rounded-full"
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
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
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
                              <Check className="ml-auto" />
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
        <div className="pl-7">
          {project.lists.map((list) => {
            const href = `/s/${spaceId}/p/${project.id}/l/${list.id}`;
            return (
              <Link
                key={list.id}
                href={href}
                className={cn(
                  childRow,
                  pathname.startsWith(href) && childRowActive,
                )}
              >
                <Hash className="size-4 shrink-0" />
                <span className="truncate">{list.name}</span>
              </Link>
            );
          })}
          {project.docs.length > 0 && (
            <p className="pl-2 mt-1 text-xs text-muted-foreground">Docs</p>
          )}
          {project.docs.map((doc) =>
            doc.firstPageId ? (
              <Link
                key={doc.id}
                href={`/s/${spaceId}/p/${project.id}/d/${doc.id}/${doc.firstPageId}`}
                className={cn(
                  childRow,
                  pathname.startsWith(
                    `/s/${spaceId}/p/${project.id}/d/${doc.id}`,
                  ) && childRowActive,
                )}
              >
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </Link>
            ) : (
              <p key={doc.id} className={childRow}>
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </p>
            ),
          )}
        </div>
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
    <div className="space-y-0.5">
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
          {items.map((project) => (
            <ProjectRow
              key={project.id}
              spaceId={spaceId}
              project={project}
              expanded={!collapsed.has(project.id)}
              onToggle={onToggle}
              canArchiveProjects={canArchiveProjects}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
