import type { Priority } from "@/server/services/types";

/*
 * The design's small flag (docs/design/list-view-*.jpg), inlined as SVG using currentColor so
 * each priority keeps its token color in light and dark mode. P4 has no flag in rows.
 */

export const PRIORITY_META: { value: Priority; label: string; className: string }[] = [
  { value: 1, label: "Urgent P1", className: "text-priority-1" },
  { value: 2, label: "High P2", className: "text-priority-2" },
  { value: 3, label: "Medium P3", className: "text-priority-3" },
  { value: 4, label: "None P4", className: "text-muted-foreground" },
];

export function PriorityFlag({
  priority,
  size = 14,
  className,
}: {
  priority: Priority;
  size?: number;
  className?: string;
}) {
  const meta = PRIORITY_META[priority - 1];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      className={`${meta.className} ${className ?? ""}`}
    >
      <path
        d="M5 22V4M5 4h13l-2 4.5 2 4.5H5"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
