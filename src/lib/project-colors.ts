/** Project color swatches offered in the UI (the server accepts any #RRGGBB). */
export const PROJECT_COLORS = [
  { name: "Slate", value: "#64748B" },
  { name: "Red", value: "#DC2626" },
  { name: "Orange", value: "#EA580C" },
  { name: "Amber", value: "#D97706" },
  { name: "Green", value: "#16A34A" },
  { name: "Teal", value: "#0D9488" },
  { name: "Blue", value: "#2563EB" },
  { name: "Indigo", value: "#4F46E5" },
  { name: "Violet", value: "#7C3AED" },
  { name: "Pink", value: "#DB2777" },
] as const;

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0].value;
