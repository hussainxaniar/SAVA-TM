/*
 * The icons a list can use (shown in the sidebar and the list header). The key is what's stored in
 * List.icon; components.tsx's registry (src/components/list-icon.tsx) maps keys to Tabler icons.
 * null / unknown = "list". Server code validates against LIST_ICON_KEYS.
 */
export const LIST_ICON_KEYS = [
  "list", "inbox", "checklist", "target", "flag", "star", "bookmark", "bug", "bulb", "rocket",
  "calendar", "chart", "code", "palette", "megaphone", "heart", "home", "briefcase", "users", "shopping",
  "book", "flask", "bell", "lock",
] as const;

export type ListIconKey = (typeof LIST_ICON_KEYS)[number];

export const isListIconKey = (value: unknown): value is ListIconKey =>
  typeof value === "string" && (LIST_ICON_KEYS as readonly string[]).includes(value);

/** What an ACTIVE status can show (6.1): a ring, or a ring filled a quarter, half or three quarters. */
export const STATUS_ICON_KEYS = ["circle", "quarter", "half", "threeQuarter"] as const;
export type StatusIconKey = (typeof STATUS_ICON_KEYS)[number];
export const isStatusIconKey = (value: unknown): value is StatusIconKey =>
  typeof value === "string" && (STATUS_ICON_KEYS as readonly string[]).includes(value);
