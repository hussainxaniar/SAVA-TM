import { IconFlagFilled } from "@tabler/icons-react";
import type { Priority } from "@/server/services/types";

/* Priority flags: Tabler's filled flag in each priority's color token (light and dark mode). */

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
  return <IconFlagFilled size={size} aria-hidden className={`shrink-0 ${meta.className} ${className ?? ""}`} />;
}
