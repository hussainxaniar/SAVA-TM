"use client";

import type { DocViewDTO, UserLite } from "@/server/services/types";

export type DocViewProps = {
  initialData: DocViewDTO;
  me: UserLite;
};

/** T-20: implemented by the implementer per docs/tickets/T-20-*.md. */
export function DocView(props: DocViewProps) {
  void props;
  return null;
}
