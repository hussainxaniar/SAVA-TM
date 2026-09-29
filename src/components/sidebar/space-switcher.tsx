"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SpaceSummaryDTO } from "@/server/services/types";

type Props = {
  current: SpaceSummaryDTO;
  spaces: SpaceSummaryDTO[];
};

function SpaceAvatar({ space, size }: { space: SpaceSummaryDTO; size: "sm" | "xs" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground",
        size === "sm" ? "size-6" : "size-5",
      )}
    >
      {space.icon ?? space.name.charAt(0).toUpperCase()}
    </span>
  );
}

const roleLabel: Record<SpaceSummaryDTO["role"], string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export function SpaceSwitcher({ current, spaces }: Props) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-accent">
        <SpaceAvatar space={current} size="sm" />
        <span className="grow truncate text-sm font-medium">{current.name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Spaces</DropdownMenuLabel>
          {spaces.map((space) => (
            <DropdownMenuItem
              key={space.id}
              className="gap-2"
              onClick={() => {
                if (space.id !== current.id) router.push(`/s/${space.id}`);
              }}
            >
              <SpaceAvatar space={space} size="xs" />
              <span className="grow truncate">{space.name}</span>
              <span className="text-xs text-muted-foreground">{roleLabel[space.role]}</span>
              <Check className={cn("size-4", space.id !== current.id && "invisible")} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}