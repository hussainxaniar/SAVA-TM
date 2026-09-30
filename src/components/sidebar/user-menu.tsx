"use client";

import { useRouter } from "next/navigation";
import { IconLogout } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { avatarColors, initials } from "@/lib/list-view";
import { authClient } from "@/lib/auth-client";

export type UserMenuProps = {
  user: { id: string; name: string; email: string; image: string | null };
};

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const { bg, fg } = avatarColors(user.id);

  async function onSignOut() {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-sidebar-accent">
        <Avatar size="sm" className="size-6 shrink-0">
          {user.image && <AvatarImage src={user.image} />}
          <AvatarFallback
            className="text-[11px] font-semibold"
            style={{ backgroundColor: bg, color: fg }}
          >
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <span className="grow truncate text-sm font-medium text-foreground">
          {user.name}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-popover-foreground">
              {user.name}
            </span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void onSignOut()}>
            <IconLogout />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
