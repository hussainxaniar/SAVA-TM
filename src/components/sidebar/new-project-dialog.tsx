"use client";

export type NewProjectDialogProps = {
  spaceId: string;
  /** Existing projects, for "Copy statuses from…". */
  projects: { id: string; name: string }[];
};

// TODO (T-06, implementer): see docs/tickets/T-06.md
export function NewProjectDialog(_props: NewProjectDialogProps) {
  return null;
}
