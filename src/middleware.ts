import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  // TODO (T-03): check Better Auth session cookie and redirect to sign-in
  // For now, allow all requests through
  return NextResponse.next();
}

export const config = {
  matcher: ["/(app)/:path*"],
};
