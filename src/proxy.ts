import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Section 7.1 (blueprint says middleware.ts; Next 16 renamed it to proxy.ts).
// Optimistic check only: no cookie → sign-in. The (app) layout validates the session
// against the database, and every service re-checks via guards.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const url = new URL("/sign-in", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

// Everything under the (app) route group: "/" and "/s/…".
export const config = {
  matcher: ["/", "/s/:path*"],
};
