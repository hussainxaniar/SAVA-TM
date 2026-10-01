"use client";

import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { Avatar } from "@/components/tasks/avatar-stack";
import type { UserLite } from "@/server/services/types";

/**
 * The Assignees picker in a PopoverContent (6.8): current space members only, filtered by a
 * borderless search. Clicking a row toggles the member (adds at the end / removes); the
 * popover stays open so several can be toggled in a row.
 */
export function AssigneePicker({
  members,
  assignees,
  onToggle,
}: {
  members: UserLite[];
  assignees: UserLite[];
  onToggle: (member: UserLite) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = members.filter((m) => m.name.toLowerCase().includes(q));

  return (
    <div className="flex flex-col">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search members"
        className="w-full bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      {shown.length === 0 ? (
        <p className="px-1.5 py-2 text-sm text-muted-foreground">No members found</p>
      ) : (
        <div className="flex flex-col">
          {shown.map((member) => {
            const assigned = assignees.some((a) => a.id === member.id);
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={assigned}
                onClick={() => onToggle(member)}
                className="flex h-8 shrink-0 items-center gap-2.5 rounded-md px-1.5 text-sm hover:bg-accent"
              >
                <Avatar user={member} className="size-5" />
                <span className="min-w-0 flex-1 truncate text-left">{member.name}</span>
                {assigned && <IconCheck aria-hidden className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}