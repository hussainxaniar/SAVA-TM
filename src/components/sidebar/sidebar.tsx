"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CircleCheck, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarDTO, SpaceSummaryDTO } from "@/server/services/types";
import { SpaceSwitcher } from "./space-switcher";
import { ProjectTree } from "./project-tree";
import { NewProjectDialog } from "./new-project-dialog";
import { UserMenu } from "./user-menu";

export type SidebarProps = {
  space: SpaceSummaryDTO;
  spaces: SpaceSummaryDTO[];
  projects: SidebarDTO["projects"];
  user: { name: string; email: string; image: string | null };
  canArchiveProjects: boolean;
};

const navRow =
  "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground";
const navRowActive = "bg-accent font-medium text-foreground";

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={cn(navRow, pathname.startsWith(href) && navRowActive)}
    >
      {icon}
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
  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r bg-muted/30">
      <div className="p-2">
        <SpaceSwitcher current={space} spaces={spaces} />
      </div>
      <nav className="space-y-0.5 px-2">
        <NavLink
          href={`/s/${space.id}/my-tasks`}
          icon={<CircleCheck className="size-4" />}
          label="My Tasks"
        />
        <NavLink
          href={`/s/${space.id}/calendar`}
          icon={<CalendarDays className="size-4" />}
          label="Calendar"
        />
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <p className="px-2 text-xs font-medium text-muted-foreground">
          Projects
        </p>
        <ProjectTree
          spaceId={space.id}
          projects={projects}
          canArchiveProjects={canArchiveProjects}
        />
        <NewProjectDialog
          spaceId={space.id}
          projects={projects.map(({ id, name }) => ({ id, name }))}
        />
      </div>
      <div className="space-y-0.5 border-t p-2">
        <NavLink
          href={`/s/${space.id}/settings`}
          icon={<Settings className="size-4" />}
          label="Space settings"
        />
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
