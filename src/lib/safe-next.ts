/**
 * Sanitises a post-sign-in `next` target: same-origin absolute paths only, so a crafted
 * link can't bounce users to another site. Anything else falls back to "/".
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
