"use client";

import type { SidebarDTO } from "@/server/services/types";

export type ProjectTreeProps = {
  spaceId: string;
  projects: SidebarDTO["projects"];
  canArchiveProjects: boolean;
};

// TODO (T-06, implementer): see docs/tickets/T-06.md
export function ProjectTree(_props: ProjectTreeProps) {
  return null;
}
