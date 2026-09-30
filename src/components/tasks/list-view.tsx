"use client";

import type { ListViewDTO } from "@/server/services/types";

export type ListViewProps = {
  initialData: ListViewDTO;
  spaceId: string;
  /** Owner/Admin: may delete lists (7.3). */
  canDeleteLists: boolean;
};

// TODO (T-09, implementer): see docs/tickets/T-09.md
export function ListView({ initialData }: ListViewProps) {
  return <div className="p-6 text-sm text-muted-foreground">{initialData.list.name}</div>;
}
