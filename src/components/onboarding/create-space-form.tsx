"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSpaceAction } from "@/server/actions/spaces";
import { createSpaceSchema } from "@/server/actions/spaces.schema";

export function CreateSpaceForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "");
    const parsed = createSpaceSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPending(true);
    setError(null);
    const res = await createSpaceAction(parsed.data);
    if (!res.ok) {
      setError(res.error.message);
      setPending(false);
      return;
    }
    router.push(`/s/${res.data.spaceId}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="space-name">Space name</Label>
        <Input
          id="space-name"
          name="name"
          autoFocus
          placeholder="e.g. Acme Design"
          maxLength={80}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create space"}
      </Button>
    </form>
  );
}
