"use client";

import type { InviteRole } from "@/server/services/types";

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

// TODO (T-05, implementer): see docs/tickets/T-05.md
export function InviteCard(_props: InviteCardProps) {
  return null;
}
