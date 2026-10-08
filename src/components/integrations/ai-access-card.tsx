"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { IconSparkles } from "@tabler/icons-react";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { revokeApiTokenAction } from "@/server/actions/api-tokens";
import type { ApiTokenDTO } from "@/server/services/types";
import { CreateTokenDialog } from "./ai-access-secret";

const scopeLabels: Record<ApiTokenDTO["scope"], string> = {
  READ: "Read-only",
  WRITE: "Read and write",
};

function TokenRow({ token }: { token: ApiTokenDTO }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onRevoke() {
    setPending(true);
    const res = await revokeApiTokenAction({ tokenId: token.id });
    setPending(false);
    setConfirmOpen(false);
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="truncate text-sm font-medium">{token.name}</span>
        <Badge variant="secondary">{scopeLabels[token.scope]}</Badge>
        {!token.mine && <span className="text-xs text-muted-foreground">{token.owner.name}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:ml-auto sm:justify-end">
        <span className="font-mono">{token.prefix}…</span>
        <span className="whitespace-nowrap">
          {token.lastUsedAt
            ? `Last used ${formatDistanceToNow(new Date(token.lastUsedAt), { addSuffix: true })}`
            : "Never used"}
        </span>
        <span className={cn("whitespace-nowrap", token.expired && "text-destructive")}>
          {token.expired
            ? "Expired"
            : token.expiresAt
              ? `Expires ${format(new Date(token.expiresAt), "MMM d, yyyy")}`
              : "Never expires"}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          Revoke
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {token.name}?</AlertDialogTitle>
            <AlertDialogDescription>Anything using it stops working immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void onRevoke();
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** AI access on the Integrations page (15.5): the user's API tokens, with create and revoke. */
export function AiAccessCard({ spaceId, tokens }: { spaceId: string; tokens: ApiTokenDTO[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">AI access</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Create token
        </Button>
      </div>
      <div className="flex items-start gap-4 rounded-lg border p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-pill">
          <IconSparkles className="size-5 text-foreground/80" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">
          Tokens let an AI assistant (Claude, for example) read and create tasks as you in this space.
        </p>
      </div>
      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {tokens.map((token) => (
            <TokenRow key={token.id} token={token} />
          ))}
        </div>
      )}
      <CreateTokenDialog spaceId={spaceId} open={createOpen} onOpenChange={setCreateOpen} />
    </section>
  );
}
