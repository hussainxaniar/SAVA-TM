"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renameSpaceAction } from "@/server/actions/spaces";
import { renameSpaceSchema } from "@/server/actions/spaces.schema";

export function SpaceNameForm({
  spaceId,
  name,
  canRename,
}: {
  spaceId: string;
  name: string;
  canRename: boolean;
}) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = renameSpaceSchema.safeParse({ spaceId, name: value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPending(true);
    setError(null);
    const res = await renameSpaceAction(parsed.data);
    setPending(false);
    if (!res.ok) setError(res.error.message);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Space name</h2>
      {canRename ? (
        <form onSubmit={onSubmit} className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={80}
              aria-label="Space name"
              className="max-w-sm"
            />
            <Button
              type="submit"
              disabled={pending || value.trim() === name.trim()}
            >
              Save
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm">
          {name}{" "}
          <span className="text-muted-foreground">
            Only the Owner can rename the space.
          </span>
        </p>
      )}
    </section>
  );
}
