/** Status color swatches offered in the UI (includes the three default status colors). */
export const STATUS_COLORS = [
  { name: "Gray", value: "#94A3B8" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#22C55E" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Orange", value: "#F97316" },
  { name: "Red", value: "#EF4444" },
  { name: "Purple", value: "#A855F7" },
  { name: "Pink", value: "#EC4899" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Slate", value: "#64748B" },
] as const;

export const STATUS_CATEGORY_LABELS = { TODO: "To do", ACTIVE: "Active", DONE: "Done" } as const;
