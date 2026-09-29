"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SpaceRole } from "@prisma/client";
import type { MemberDTO } from "@/server/services/types";
import { changeRoleAction, removeMemberAction } from "@/server/actions/spaces";

/** A member plus what the viewer may do to them (decided on the server from Section 7.3). */
export type MemberRow = MemberDTO & {
  isViewer: boolean;
  canChangeRole: boolean;
  canRemove: boolean;
};

const roleLabel: Record<SpaceRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function MemberRowItem({
  spaceId,
  member,
}: {
  spaceId: string;
  member: MemberRow;
}) {
  const [role, setRole] = useState<SpaceRole>(member.role);
  const [rolePending, setRolePending] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removePending, setRemovePending] = useState(false);

  async function onRoleChange(value: SpaceRole | null) {
    if (!value) return;
    const next = value as SpaceRole;
    setRole(next);
    setRolePending(true);
    const res = await changeRoleAction({
      spaceId,
      userId: member.id,
      role: next,
    });
    setRolePending(false);
    if (!res.ok) {
      setRole(member.role);
      toast.error(res.error.message);
    }
  }

  async function onRemove() {
    setRemovePending(true);
    const res = await removeMemberAction({ spaceId, userId: member.id });
    setRemovePending(false);
    if (!res.ok) {
      toast.error(res.error.message);
    } else {
      setRemoveOpen(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar className="size-8">
        {member.image && <AvatarImage src={member.image} />}
        <AvatarFallback>{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.name}
          {member.isViewer && (
            <span className="text-muted-foreground"> (you)</span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      {member.canChangeRole ? (
        <Select
          items={{ OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" }}
          value={role}
          onValueChange={onRoleChange}
          disabled={rolePending}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OWNER">Owner</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="MEMBER">Member</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="secondary">{roleLabel[role]}</Badge>
      )}
      {member.canRemove && (
        <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
            Remove
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                They lose access to this space and are unassigned from its
                tasks.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={removePending}
                onClick={(e) => {
                  e.preventDefault();
                  void onRemove();
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export function MembersTable({
  spaceId,
  members,
}: {
  spaceId: string;
  members: MemberRow[];
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Members</h2>
      <p className="text-sm text-muted-foreground">
        Everyone here can see all projects, lists, tasks and docs.
      </p>
      <div className="divide-y rounded-lg border">
        {members.map((member) => (
          <MemberRowItem key={member.id} spaceId={spaceId} member={member} />
        ))}
      </div>
    </section>
  );
}
