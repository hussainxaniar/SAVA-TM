"use client";

import type { SidebarDTO, UserLite } from "@/server/services/types";

export type QuickAddDialogProps = {
  spaceId: string;
  /** The sidebar tree: every active project with its lists, in position order. */
  projects: SidebarDTO["projects"];
  /** Space members, for `@` autocomplete and assignee chips. */
  members: UserLite[];
};

/** T-10: implemented by the implementer per docs/tickets/T-10.md. */
export function QuickAddDialog(props: QuickAddDialogProps) {
  void props;
  return null;
}
