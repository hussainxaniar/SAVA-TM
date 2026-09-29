"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { InviteRole } from "@/server/services/types";
import { acceptInviteAction } from "@/server/actions/spaces";

export type InviteCardProps = {
  token: string;
  /** Null only when the token is unknown. */
  spaceName: string | null;
  /** Null when the invite can't be used. */
  role: InviteRole | null;
  /** Human-readable reason the invite can't be used, or null when it's valid. */
  problem: string | null;
  /** Email of the signed-in user, or null when signed out. */
  signedInAs: string | null;
};

const roleLabel: Record<InviteRole, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
};

export function InviteCard({
  token,
  spaceName,
  role,
  problem,
  signedInAs,
}: InviteCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (problem) {
    return (
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-6">
        <h1 className="text-lg font-semibold">Invite unavailable</h1>
        <p className="text-sm text-muted-foreground">{problem}</p>
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Go to Sava TM
        </Button>
      </div>
    );
  }

  async function onJoin() {
    setPending(true);
    setError(null);
    const res = await acceptInviteAction({ token });
    setPending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/s/${res.data.spaceId}`);
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border p-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Join {spaceName}</h1>
        {signedInAs === null ? (
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join as{" "}
            {role ? roleLabel[role] : "a member"}. Sign in or create an account
            to accept.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            You&apos;ll join as {role ? roleLabel[role] : "a member"}.
          </p>
        )}
      </div>
      {signedInAs === null ? (
        <div className="space-y-2">
          <Button
            variant="default"
            className="w-full"
            nativeButton={false}
            render={
              <Link
                href={`/sign-up?next=${encodeURIComponent(`/invite/${token}`)}`}
              />
            }
          >
            Create account
          </Button>
          <Button
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={
              <Link
                href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
              />
            }
          >
            Sign in
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Signed in as {signedInAs}
          </p>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => void onJoin()}
          >
            {pending ? "Joining…" : `Join ${spaceName}`}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
