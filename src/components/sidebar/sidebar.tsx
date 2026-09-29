"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import type { SidebarDTO, SpaceSummaryDTO } from "@/server/services/types";
import { SpaceSwitcher } from "./space-switcher";

export type SidebarProps = {
  space: SpaceSummaryDTO;
  spaces: SpaceSummaryDTO[];
  projects: SidebarDTO["projects"];
  user: { name: string; email: string; image: string | null };
  canArchiveProjects: boolean;
};

// TODO (T-06, implementer): full sidebar — see docs/tickets/T-06.md. This stub keeps the
// T-04/T-05 behaviour (switcher + settings link) so the app works until then.
export function Sidebar({ space, spaces }: SidebarProps) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r bg-muted/30">
      <div className="p-2">
        <SpaceSwitcher current={space} spaces={spaces} />
      </div>
      <div className="mt-auto border-t p-2">
        <Link
          href={`/s/${space.id}/settings`}
          className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings className="size-4" />
          Space settings
        </Link>
      </div>
    </aside>
  );
}
