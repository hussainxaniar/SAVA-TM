"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InviteDTO, InviteRole } from "@/server/services/types";
import {
  createInviteAction,
  revokeInviteAction,
} from "@/server/actions/spaces";
import { createInviteSchema } from "@/server/actions/spaces.schema";

const roleItems: Record<InviteRole, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
};

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={onCopy}>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function InviteRow({ invite }: { invite: InviteDTO }) {
  const [pending, setPending] = useState(false);

  async function onRevoke() {
    setPending(true);
    const res = await revokeInviteAction({ inviteId: invite.id });
    setPending(false);
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Badge variant="secondary">{roleItems[invite.role]}</Badge>
      <span className="min-w-0 flex-1 truncate font-mono text-xs">
        {invite.url}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {invite.uses}
        {invite.maxUses !== null ? ` / ${invite.maxUses}` : ""} uses
      </span>
      {invite.status === "ACTIVE" ? (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Expires{" "}
          {formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}
        </span>
      ) : (
        <Badge variant="outline">
          {invite.status === "EXPIRED" ? "Expired" : "Used up"}
        </Badge>
      )}
      {invite.status === "ACTIVE" && <CopyButton url={invite.url} />}
      {invite.status === "ACTIVE" && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={onRevoke}>
          Revoke
        </Button>
      )}
    </div>
  );
}

export function InviteLinks({
  spaceId,
  invites,
}: {
  spaceId: string;
  invites: InviteDTO[];
}) {
  const [role, setRole] = useState<InviteRole>("MEMBER");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [maxUses, setMaxUses] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = {
      spaceId,
      role,
      expiresInDays,
      maxUses: maxUses.trim() === "" ? null : Number(maxUses),
    };
    const parsed = createInviteSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPending(true);
    setError(null);
    const res = await createInviteAction(parsed.data);
    setPending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    try {
      await navigator.clipboard.writeText(res.data.url);
    } catch {
      toast.error("Couldn't copy the link");
    }
    setMaxUses("");
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Invite links</h2>
      <p className="text-sm text-muted-foreground">
        Anyone with a link can join this space until it expires or runs out of
        uses.
      </p>
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={{ ADMIN: "Admin", MEMBER: "Member" }}
            value={role}
            onValueChange={(v) => {
              if (v) setRole(v as InviteRole);
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="MEMBER">Member</SelectItem>
            </SelectContent>
          </Select>
          <Select
            items={{ 1: "1 day", 7: "7 days", 30: "30 days" }}
            value={String(expiresInDays)}
            onValueChange={(v) => {
              if (v !== null) setExpiresInDays(Number(v));
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            max={1000}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Unlimited"
            aria-label="Max uses"
            className="w-28"
          />
          <Button type="submit" disabled={pending}>
            Create link
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      {invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invite links yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {invites.map((invite) => (
            <InviteRow key={invite.id} invite={invite} />
          ))}
        </div>
      )}
    </section>
  );
}
