"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CircleCheck, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestQuickAdd } from "@/lib/quick-add";
import { ThemeToggle } from "@/components/theme-toggle";
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

export function Sidebar({
  space,
  spaces,
  projects,
  user,
  canArchiveProjects,
}: SidebarProps) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-2 py-3">
      <SpaceSwitcher current={space} spaces={spaces} />
      <button
        type="button"
        onClick={requestQuickAdd}
        className="mt-2 flex h-9 items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent"
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
          <Plus className="size-3 text-primary-foreground" strokeWidth={3} />
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
          icon={CircleCheck}
          label="My Tasks"
        />
        <NavLink
          href={`/s/${space.id}/calendar`}
          icon={Calendar}
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
          <Plus className="size-4" />
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
          <Plus className="size-4 shrink-0" />
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
        <UserMenu user={user} />
        <ThemeToggle />
      </div>
    </aside>
  );
}
