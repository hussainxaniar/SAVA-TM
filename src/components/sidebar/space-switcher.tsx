"use client";

import type { SpaceSummaryDTO } from "@/server/services/types";

// TODO (T-04, implementer): see docs/tickets/T-04.md
export function SpaceSwitcher({ current }: { current: SpaceSummaryDTO; spaces: SpaceSummaryDTO[] }) {
  return <div className="px-2 py-1.5 text-sm font-medium">{current.name}</div>;
}
