import { memo } from "react";
import { avatarColors, initials } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import type { UserLite } from "@/server/services/types";

export const Avatar = memo(function Avatar({
  user,
  className,
}: {
  user: UserLite;
  className?: string;
}) {
  const { bg, fg } = avatarColors(user.id);
  return (
    <span
      title={user.name}
      style={{ backgroundColor: bg, color: fg }}
      className={cn(
        "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
        className,
      )}
    >
      {initials(user.name)}
    </span>
  );
});

/** Up to three assignee avatars, overlapping with a background ring when stacked. */
export function AvatarStack({ users }: { users: UserLite[] }) {
  const shown = users.slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <div className="flex items-center">
      {shown.map((user, i) => (
        <Avatar
          key={user.id}
          user={user}
          // Design: stacked avatars are 26px with a 2px background border, overlapping 6px.
          className={cn(shown.length > 1 && "size-[26px] border-2 border-background", i > 0 && "-ml-1.5")}
        />
      ))}
    </div>
  );
}
