import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { LAST_SPACE_COOKIE } from "@/lib/last-space";

// Section 7.1 (blueprint says middleware.ts; Next 16 renamed it to proxy.ts).
// Optimistic check only: no cookie → sign-in. The (app) layout validates the session
// against the database, and every service re-checks via guards.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  // Remember the last space opened (T-04). "/" validates membership before using it.
  const spaceId = pathname.match(/^\/s\/([^/]+)/)?.[1];
  if (spaceId && request.cookies.get(LAST_SPACE_COOKIE)?.value !== spaceId) {
    response.cookies.set(LAST_SPACE_COOKIE, spaceId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

// Everything under the (app) route group: "/" and "/s/…".
export const config = {
  matcher: ["/", "/s/:path*"],
};
