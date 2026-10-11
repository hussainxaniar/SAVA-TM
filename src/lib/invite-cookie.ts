/**
 * Cookie holding the token of the last invite link opened (Section 7.2.6). Set by proxy.ts on
 * `/invite/<token>`; the sign-up gate in src/server/auth.ts reads it, so a Google sign-up that
 * comes back from Google still carries its invite.
 */
export const INVITE_COOKIE = "sava_invite";

/** The invite token of an `/invite/<token>` path, or null. */
export function inviteTokenFromPath(path: string): string | null {
  const token = /^\/invite\/([A-Za-z0-9_-]{1,100})(?:[/?#]|$)/.exec(path)?.[1];
  return token ?? null;
}
