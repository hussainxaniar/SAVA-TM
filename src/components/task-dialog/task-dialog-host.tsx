"use client";

export type TaskDialogHostProps = {
  spaceId: string;
};

/**
 * T-11: renders the task dialog while the URL has `?task=<id>`, on any page of the space.
 * Implemented by the implementer per docs/tickets/T-11.md.
 */
export function TaskDialogHost(props: TaskDialogHostProps) {
  void props;
  return null;
}
