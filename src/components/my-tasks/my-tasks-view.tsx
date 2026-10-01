"use client";

import type { MyTasksDTO } from "@/server/services/types";

export type MyTasksViewProps = {
  spaceId: string;
  initialData: MyTasksDTO;
};

/** T-16: implemented by the implementer per docs/tickets/T-16.md. */
export function MyTasksView(props: MyTasksViewProps) {
  void props;
  return null;
}
