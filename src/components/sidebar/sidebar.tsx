"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconCalendar,
  IconCircleCheck,
  IconLayoutSidebar,
  IconMenu2,
  IconPlus,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { requestQuickAdd } from "@/lib/quick-add";
import { ThemeToggle } from "@/components/theme-toggle";
import { TOGGLE_SIDEBAR_EVENT } from "@/hooks/use-global-shortcuts";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useIsMobile } from "@/hooks/use-media-query";
import type { SidebarDTO, SpaceSummaryDTO } from "@/server/services/types";
import { SpaceSwitcher } from "./space-switcher";
import { ProjectTree } from "./project-tree";
import { NewProjectDialog } from "./new-project-dialog";
import { UserMenu } from "./user-menu";

export type SidebarProps = {
  space: SpaceSummaryDTO;
  spaces: SpaceSummaryDTO[];
  projects: SidebarDTO["projects"];
  user: { id: string; name: string; email: string; image: string | null };
  canArchiveProjects: boolean;
  /** The main view; rendered by the shell so collapse/drawer state can live here (9.1). */
  children: React.ReactNode;
};

const navRow =
  "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-foreground hover:bg-sidebar-accent";
const navRowActive = "bg-selected font-medium text-selected-foreground";

function NavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link href={href} className={cn(navRow, active && navRowActive)}>
      <Icon
        className={cn(
          "size-[18px] shrink-0 text-muted-foreground",
          active && "text-selected-foreground",
        )}
      />
      {label}
    </Link>
  );
}

/** Switcher, Add task, nav, project tree and the user footer — shared by both shells. */
function SidebarContent({
  space,
  spaces,
  projects,
  user,
  canArchiveProjects,
}: Omit<SidebarProps, "children">) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <>
      <SpaceSwitcher current={space} spaces={spaces} />
      <button
        type="button"
        onClick={requestQuickAdd}
        className="mt-2 flex h-9 items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent"
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
          <IconPlus className="size-3 text-primary-foreground" strokeWidth={3} />
        </span>
        <span className="grow text-left text-sm font-semibold text-primary">
          Add task
        </span>
        <span className="rounded-[4px] border border-border bg-background px-[5px] text-xs font-medium text-muted-foreground">
          Q
        </span>
      </button>
      <nav className="mt-1 flex flex-col">
        <NavLink
          href={`/s/${space.id}/my-tasks`}
          icon={IconCircleCheck}
          label="My Tasks"
        />
        <NavLink
          href={`/s/${space.id}/calendar`}
          icon={IconCalendar}
          label="Calendar"
        />
      </nav>
      <div className="mt-5 flex h-7 items-center px-2">
        <p className="grow text-xs font-semibold tracking-[0.02em] text-muted-foreground">
          Projects
        </p>
        <button
          type="button"
          aria-label="New project"
          onClick={() => setNewProjectOpen(true)}
          className="flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <IconPlus className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ProjectTree
          spaceId={space.id}
          projects={projects}
          canArchiveProjects={canArchiveProjects}
        />
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          className="mt-1 flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
        >
          <IconPlus className="size-4 shrink-0" />
          New project
        </button>
        <NewProjectDialog
          spaceId={space.id}
          projects={projects.map(({ id, name }) => ({ id, name }))}
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
        />
      </div>
      <div className="-mx-2 flex h-10 items-center gap-2 border-t border-sidebar-border px-4">
        <UserMenu user={user} spaceId={space.id} />
        <ThemeToggle />
      </div>
    </>
  );
}

/**
 * The space shell (9.1). Above 768px: a 260px sidebar that `[` collapses to 0 (per-browser
 * preference) with a floating reopen button on the main area. Below: a slim top bar with a
 * hamburger that opens the sidebar as a fixed drawer (backdrop click / Esc / navigation close),
 * and the layout stacks into a column. `[` and the part-1 `sava:toggle-sidebar` event drive both.
 */
export function Sidebar({
  space,
  spaces,
  projects,
  user,
  canArchiveProjects,
  children,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useLocalStorage("sava.sidebar.collapsed", false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();

  useEffect(() => {
    function onToggle() {
      if (isMobile) setDrawerOpen((open) => !open);
      else setCollapsed(!collapsed);
    }
    window.addEventListener(TOGGLE_SIDEBAR_EVENT, onToggle);
    return () => window.removeEventListener(TOGGLE_SIDEBAR_EVENT, onToggle);
  }, [isMobile, collapsed, setCollapsed]);

  // The drawer closes on navigation: adjusting state during render on a pathname change
  // (react.dev "adjusting state when a prop changes") keeps it out of an effect.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  // The drawer closes on Esc.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Slim top bar, below 768px only. */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2 md:hidden">
        <button
          type="button"
          aria-label="Open sidebar"
          onClick={() => setDrawerOpen(true)}
          className="flex size-9 items-center justify-center rounded-md text-foreground hover:bg-sidebar-accent"
        >
          <IconMenu2 className="size-5" />
        </button>
        <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">
          Sava
        </span>
      </header>

      {/* Desktop: the 260px column, collapsed to 0 by `[` with a width transition. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar px-2 py-3 transition-[width] duration-200 ease-in-out md:flex",
          collapsed ? "w-0 border-r-0 px-0" : "w-[260px]",
        )}
      >
        <SidebarContent
          space={space}
          spaces={spaces}
          projects={projects}
          user={user}
          canArchiveProjects={canArchiveProjects}
        />
      </aside>

      {/* Main area; the reopen button floats in its top-left while collapsed. */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-auto">
        {!isMobile && collapsed && (
          <button
            type="button"
            aria-label="Show sidebar"
            onClick={() => setCollapsed(false)}
            className="absolute left-2 top-2 z-10 flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:bg-sidebar-accent"
          >
            <IconLayoutSidebar className="size-4" />
          </button>
        )}
        {children}
      </div>

      {/* Mobile drawer: fixed 280px panel over a dimmed backdrop, mounted only below 768px. */}
      {isMobile && (
        <>
          <div
            aria-hidden
            onClick={() => setDrawerOpen(false)}
            className={cn(
              "fixed inset-0 z-40 bg-foreground/40 transition-opacity duration-200 md:hidden",
              drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Space navigation"
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar px-2 py-3 shadow-xl transition-transform duration-200 ease-in-out md:hidden",
              drawerOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <SidebarContent
              space={space}
              spaces={spaces}
              projects={projects}
              user={user}
              canArchiveProjects={canArchiveProjects}
            />
          </aside>
        </>
      )}
    </div>
  );
}
