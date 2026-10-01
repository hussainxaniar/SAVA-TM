import { NextResponse, type NextRequest } from "next/server";
import { sessionUserFromHeaders } from "@/server/auth";
import { AppError } from "@/server/errors";
import { handleGoogleCallback } from "@/server/services/google-calendar";

// Section 10.2: Google redirects here after consent. Verify the signed state, store the tokens,
// push pending blocks, then send the user back to their space's Integrations page with an outcome.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const back = (spaceId: string | null, outcome: string, message?: string) => {
    const target = new URL(spaceId ? `/s/${spaceId}/integrations` : "/", url.origin);
    target.searchParams.set("google", outcome);
    if (message) target.searchParams.set("message", message);
    return NextResponse.redirect(target);
  };

  const user = await sessionUserFromHeaders(request.headers);
  if (!user) return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`, url.origin));

  const spaceHint = spaceFromState(url.searchParams.get("state"));
  const error = url.searchParams.get("error");
  if (error) return back(spaceHint, "cancelled", error === "access_denied" ? "Google Calendar wasn't connected." : error);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back(spaceHint, "error", "Google didn't send a sign-in code. Try again.");

  try {
    const { spaceId } = await handleGoogleCallback({ userId: user.id }, { code, state });
    return back(spaceId, "connected");
  } catch (e) {
    const message = e instanceof AppError ? e.message : "Connecting Google Calendar failed. Try again.";
    if (!(e instanceof AppError)) console.error("Google callback failed", e);
    return back(spaceHint, "error", message);
  }
}

/** The (unverified) space id inside the state, only to choose where to show an error. */
function spaceFromState(state: string | null): string | null {
  try {
    const payload = JSON.parse(Buffer.from((state ?? "").split(".")[0], "base64url").toString("utf8"));
    return typeof payload.s === "string" && /^[a-z0-9]+$/i.test(payload.s) ? payload.s : null;
  } catch {
    return null;
  }
}
