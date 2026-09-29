import type { StatusCategory } from "@prisma/client";

// Section 6.1.1 / 6.3.1 / 7.2.1 defaults, shared by services and the seed.

export const DEFAULT_STATUSES: readonly { name: string; color: string; category: StatusCategory }[] = [
  { name: "To do", color: "#94A3B8", category: "TODO" },
  { name: "In progress", color: "#3B82F6", category: "ACTIVE" },
  { name: "Done", color: "#22C55E", category: "DONE" },
];

export const DEFAULT_LIST_NAME = "General";

export const DEFAULT_PROJECT_NAME = "Getting started";
