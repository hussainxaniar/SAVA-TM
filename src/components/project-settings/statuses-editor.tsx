"use client";

import type { ProjectSettingsDTO } from "@/server/services/types";

export type StatusesEditorProps = {
  projectId: string;
  statuses: ProjectSettingsDTO["statuses"];
  /** Owner/Admin. Members see a read-only list. */
  canEdit: boolean;
};

// TODO (T-07, implementer): see docs/tickets/T-07.md
export function StatusesEditor(_props: StatusesEditorProps) {
  return null;
}
