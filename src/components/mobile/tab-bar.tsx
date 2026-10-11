"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconCalendar,
  IconCircleCheck,
  IconMenu2,
  IconStack2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/** The four bottom tabs (M-01): icon 24 over an 11/14 label; the active tab is primary. */
export function TabBar({ spaceId }: { spaceId: string }) {
  const pathname = usePathname();

  const tabs = [
    {
      label: "My tasks",
      href: `/s/${spaceId}/my-tasks`,
      icon: IconCircleCheck,
      active: pathname.startsWith(`/s/${spaceId}/my-tasks`),
    },
    {
      label: "Calendar",
      href: `/s/${spaceId}/calendar`,
      icon: IconCalendar,
      active: pathname.startsWith(`/s/${spaceId}/calendar`),
    },
    {
      label: "All tasks",
      href: `/s/${spaceId}/all`,
      icon: IconStack2,
      active:
        pathname.startsWith(`/s/${spaceId}/all`) ||
        pathname.startsWith(`/s/${spaceId}/p/`),
    },
    {
      label: "More",
      href: `/s/${spaceId}/more`,
      icon: IconMenu2,
      active:
        pathname.startsWith(`/s/${spaceId}/more`) ||
        pathname.startsWith(`/s/${spaceId}/settings`) ||
        pathname.startsWith(`/s/${spaceId}/integrations`) ||
        pathname.startsWith(`/s/${spaceId}/notifications`),
    },
  ];

  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 border-t border-border bg-background px-2 pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map(({ label, href, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-[3px]",
            active ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Icon className="size-6" stroke={active ? 2 : 1.8} />
          <span
            className={cn(
              "text-[11px] leading-[14px] font-medium",
              active && "font-semibold",
            )}
          >
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
