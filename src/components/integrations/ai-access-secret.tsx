"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createApiTokenAction } from "@/server/actions/api-tokens";
import { createApiTokenSchema } from "@/server/actions/api-tokens.schema";

type CreatedToken = { id: string; token: string; prefix: string };

const expiryItems: Record<string, string> = {
  "30": "30 days",
  "90": "90 days",
  "365": "1 year",
  never: "Never",
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Couldn't copy the ${label.toLowerCase()}`);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void onCopy()}>
      {copied ? <IconCheck aria-hidden /> : <IconCopy aria-hidden />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function ScopeOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors",
        selected ? "border-foreground/30 bg-pill" : "border-input",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-muted-foreground/50",
        )}
      >
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      {label}
    </button>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-[5px] px-3 py-[3px] text-xs leading-4",
        active ? "bg-background font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function CreateTokenForm({
  spaceId,
  onCreated,
}: {
  spaceId: string;
  onCreated: (token: CreatedToken) => void;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"READ" | "WRITE">("WRITE");
  const [expiry, setExpiry] = useState("90");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = createApiTokenSchema.safeParse({
      spaceId,
      name,
      scope,
      expiresInDays: expiry === "never" ? null : Number(expiry),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPending(true);
    setError(null);
    const res = await createApiTokenAction(parsed.data);
    setPending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    onCreated(res.data);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Create token</DialogTitle>
        <DialogDescription>Give an AI assistant access to this space as you.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="token-name">Name</Label>
        <Input
          id="token-name"
          autoFocus
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Claude Desktop"
        />
      </div>
      <div className="space-y-2">
        <Label>Scope</Label>
        <div role="radiogroup" aria-label="Scope" className="flex flex-col gap-2">
          <ScopeOption label="Read-only" selected={scope === "READ"} onSelect={() => setScope("READ")} />
          <ScopeOption label="Read and write" selected={scope === "WRITE"} onSelect={() => setScope("WRITE")} />
        </div>
        <p className="text-xs text-muted-foreground">
          Read-only can look at tasks; read and write can also create and change them.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="token-expiry">Expires</Label>
        <Select
          items={expiryItems}
          value={expiry}
          onValueChange={(v) => {
            if (v !== null) setExpiry(v);
          }}
        >
          <SelectTrigger id="token-expiry" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
            <SelectItem value="365">1 year</SelectItem>
            <SelectItem value="never">Never</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create token"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Shown once after creation: the secret, then ready-made setup snippets for the current origin. */
function SecretStep({ token, onDone }: { token: CreatedToken; onDone: () => void }) {
  const [tab, setTab] = useState<"code" | "desktop">("code");
  const mcpUrl = `${window.location.origin}/api/mcp`;
  const snippets = {
    code: `claude mcp add --transport http sava ${mcpUrl} --header "Authorization: Bearer ${token.token}"`,
    desktop: JSON.stringify(
      {
        mcpServers: {
          sava: {
            command: "npx",
            args: ["-y", "mcp-remote", mcpUrl, "--header", `Authorization: Bearer ${token.token}`],
          },
        },
      },
      null,
      2,
    ),
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Token created</DialogTitle>
        <DialogDescription>{token.prefix}… — pick your client and paste the setup.</DialogDescription>
      </DialogHeader>
      <p className="text-sm font-medium text-destructive">
        Copy this token now. You won&apos;t be able to see it again.
      </p>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={token.token}
          aria-label="API token"
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
        />
        <CopyButton text={token.token} label="Copy" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex rounded-md bg-pill p-0.5">
            <TabButton label="Claude Code" active={tab === "code"} onClick={() => setTab("code")} />
            <TabButton label="Claude Desktop" active={tab === "desktop"} onClick={() => setTab("desktop")} />
          </div>
          <CopyButton text={snippets[tab]} label="Copy" />
        </div>
        <pre className="max-h-44 overflow-auto rounded-md bg-pill p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {snippets[tab]}
        </pre>
      </div>
      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}

export function CreateTokenDialog({
  spaceId,
  open,
  onOpenChange,
}: {
  spaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [created, setCreated] = useState<CreatedToken | null>(null);

  function close() {
    setCreated(null); // the secret is shown once and never kept
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <SecretStep token={created} onDone={close} />
        ) : (
          <CreateTokenForm spaceId={spaceId} onCreated={setCreated} />
        )}
      </DialogContent>
    </Dialog>
  );
}
