"use client";

import type { ProjectSettingsDTO } from "@/server/services/types";

export type ListsEditorProps = {
  spaceId: string;
  projectId: string;
  lists: ProjectSettingsDTO["lists"];
  /** Owner/Admin may delete lists; everyone may create, rename and reorder. */
  canDelete: boolean;
};

// TODO (T-07, implementer): see docs/tickets/T-07.md
export function ListsEditor(_props: ListsEditorProps) {
  return null;
}
