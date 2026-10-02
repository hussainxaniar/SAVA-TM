"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconPlus,
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreatePage, useDeletePage, useMovePage } from "@/hooks/use-doc";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { MAX_PAGE_DEPTH, flattenTree, projectDrop, subtreeIds } from "@/lib/page-tree";
import { cn } from "@/lib/utils";
import type { PageTreeNodeDTO } from "@/server/services/types";

export type PageTreeProps = {
  docId: string;
  spaceId: string;
  projectId: string;
  tree: PageTreeNodeDTO[];
  currentPageId: string;
};

/** One level of nesting (Section 11.1) and the drop maths' indent unit. */
const INDENT = 16;

const noopSubscribe = () => () => {};

/**
 * The 220px page tree (Section 11.1): collapsible rows, drag to reorder or re-nest (the
 * horizontal drag distance picks the new depth, projectDrop does the maths), "+" on hover to
 * add a child page, ⋯ with Delete behind a confirm dialog, and an Add page button for
 * top-level pages.
 */
export function PageTree({ docId, spaceId, projectId, tree, currentPageId }: PageTreeProps) {
  const router = useRouter();
  const createPage = useCreatePage(docId);
  const movePage = useMovePage(docId);
  const deletePage = useDeletePage(docId);

  // Per-browser preference: which pages are collapsed, by page id.
  const [collapsedIds, setCollapsedIds] = useLocalStorage(
    `sava.doc.${docId}.collapsed`,
    [] as string[],
  );
  const collapsed = useMemo(() => new Set(collapsedIds), [collapsedIds]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<PageTreeNodeDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const rows = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);
  // While dragging, the dragged page's own subtree stays in place: hide it, the active row
  // holds the slot and the DragOverlay follows the pointer.
  const draggingSubtree = useMemo(
    () => (activeId ? new Set(subtreeIds(tree, activeId)) : null),
    [activeId, tree],
  );
  const visibleRows = useMemo(
    () =>
      draggingSubtree
        ? rows.filter((r) => r.node.id === activeId || !draggingSubtree.has(r.node.id))
        : rows,
    [rows, draggingSubtree, activeId],
  );

  // Stable id: dnd-kit's global aria counter differs between server and client renders.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // The overlay portals into <body>, which only exists after hydration (false on the server).
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  function openPage(pageId: string) {
    router.push(`/s/${spaceId}/p/${projectId}/d/${docId}/${pageId}`);
  }

  function toggleCollapsed(id: string) {
    setCollapsedIds(collapsedIds.includes(id) ? collapsedIds.filter((c) => c !== id) : [...collapsedIds, id]);
  }

  async function addTopLevel() {
    try {
      const { pageId } = await createPage.mutateAsync({ parentId: null });
      openPage(pageId);
    } catch {
      // the hook toasted the server's message
    }
  }

  async function addChild(node: PageTreeNodeDTO) {
    try {
      const { pageId } = await createPage.mutateAsync({ parentId: node.id });
      // The new page opens, so its parent must not hide it behind a collapse.
      if (collapsedIds.includes(node.id)) {
        setCollapsedIds(collapsedIds.filter((c) => c !== node.id));
      }
      openPage(pageId);
    } catch {
      // the hook toasted (the depth limit lives server-side)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeletePending(true);
    try {
      await deletePage.mutateAsync({ pageId: target.id });
      setDeleteTarget(null);
      // If the open page went away, land on its parent, else the first remaining top-level
      // page (11.3). The server refused the last page of a doc: the hook toasted, no navigate.
      const gone = new Set(subtreeIds(tree, target.id));
      if (gone.has(currentPageId)) {
        const dest =
          target.parentId ?? rows.find((r) => r.depth === 0 && !gone.has(r.node.id))?.node.id;
        if (dest) openPage(dest);
      }
    } catch {
      // the hook toasted; keep the dialog open so the user can back out
    } finally {
      setDeletePending(false);
    }
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setOffsetX(0);
  }

  // The horizontal offset picks the new depth (one indent per level, projectDrop clamps it).
  function onDragMove({ delta }: DragMoveEvent) {
    setOffsetX(delta.x);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOffsetX(0);
    if (!over) return;
    const drop = projectDrop(rows, tree, String(active.id), String(over.id), offsetX, INDENT);
    if (!drop) return;
    movePage.mutate({
      pageId: String(active.id),
      parentId: drop.parentId,
      beforeId: drop.beforeId,
      afterId: drop.afterId,
    });
    // A page nested under a collapsed parent would disappear: expand the parent.
    if (drop.parentId && collapsedIds.includes(drop.parentId)) {
      setCollapsedIds(collapsedIds.filter((c) => c !== drop.parentId));
    }
  }

  function onDragCancel() {
    setActiveId(null);
    setOffsetX(0);
  }

  const draggingTitle = activeId
    ? tree.find((n) => n.id === activeId)?.title.trim() || "Untitled"
    : "";
  const deleteCount = deleteTarget ? subtreeIds(tree, deleteTarget.id).length - 1 : 0;

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-panel">
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <SortableContext
            items={visibleRows.map((r) => r.node.id)}
            strategy={verticalListSortingStrategy}
          >
            {visibleRows.map((row) => (
              <PageRow
                key={row.node.id}
                row={row}
                active={row.node.id === currentPageId}
                collapsed={collapsed.has(row.node.id)}
                onOpen={() => openPage(row.node.id)}
                onToggle={() => toggleCollapsed(row.node.id)}
                onAddChild={() => void addChild(row.node)}
                onDelete={() => setDeleteTarget(row.node)}
              />
            ))}
          </SortableContext>
          {hydrated &&
            createPortal(
              <DragOverlay dropAnimation={null}>
                {activeId ? (
                  <div className="flex h-9 w-[220px] cursor-grabbing items-center rounded-md border bg-background px-2 text-sm shadow-lg">
                    <span className="truncate">{draggingTitle}</span>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )}
        </DndContext>
      </div>
      <div className="shrink-0 border-t border-divider p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-1.5 text-muted-foreground"
          onClick={() => void addTopLevel()}
        >
          <IconPlus className="size-3.5" />
          Add page
        </Button>
      </div>
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            {deleteCount > 0 && (
              <AlertDialogDescription>
                This also deletes {deleteCount} subpage{deleteCount === 1 ? "" : "s"}.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={(e) => {
                e.preventDefault(); // AlertDialogAction doesn't auto-close; only success does
                void confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

/** One 36px row: chevron, title, hover actions; drag starts from anywhere on the row. */
function PageRow({
  row,
  active,
  collapsed,
  onOpen,
  onToggle,
  onAddChild,
  onDelete,
}: {
  row: { node: PageTreeNodeDTO; depth: number; hasChildren: boolean };
  active: boolean;
  collapsed: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onAddChild: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.node.id,
  });
  const title = row.node.title.trim() || "Untitled";

  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
        paddingLeft: 6 + row.depth * INDENT,
      }}
      className={cn(
        "group flex h-9 cursor-pointer items-center rounded-md pr-1.5 text-sm",
        active
          ? "bg-selected font-medium text-selected-foreground"
          : "text-foreground/80 hover:bg-sidebar-accent",
        isDragging && "relative z-10 opacity-50",
      )}
      {...attributes}
      {...listeners}
    >
      {row.hasChildren ? (
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation(); // the row navigates; the chevron only folds
            onToggle();
          }}
          className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
        >
          {collapsed ? (
            <IconChevronRight className="size-3" strokeWidth={3} />
          ) : (
            <IconChevronDown className="size-3" strokeWidth={3} />
          )}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className={cn("min-w-0 grow truncate", title === "Untitled" && "text-muted-foreground")}>
        {title}
      </span>
      {row.depth < MAX_PAGE_DEPTH && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Add a page under ${title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
          className={cn(
            "shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          <IconPlus />
        </Button>
      )}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`${title} options`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100",
                menuOpen && "opacity-100",
              )}
            />
          }
        >
          <IconDots />
        </DropdownMenuTrigger>
        {/* The menu is portaled, but React still bubbles its clicks and keys to the row, which would
            navigate (or start a drag) and drop the confirm dialog's state. */}
        <DropdownMenuContent onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
