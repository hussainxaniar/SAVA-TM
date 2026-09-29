import { cache } from "react";
import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { AppError } from "./errors";

// Section 7.1. Google sign-in uses Better Auth's default scopes (openid email profile);
// Calendar access is a separate consent (Section 10), never requested here.

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const googleSignInEnabled = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.APP_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    autoSignIn: true,
  },
  socialProviders: googleSignInEnabled
    ? { google: { clientId: googleClientId!, clientSecret: googleClientSecret! } }
    : {},
  // Rate limiting is Better Auth's default: on in production.
  plugins: [nextCookies()], // must stay last
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/** Session user for a set of request headers, or null when signed out / expired. */
export async function sessionUserFromHeaders(h: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
}

/** Current request's user, or null. Deduplicated per request. */
export const getOptionalSessionUser = cache(async (): Promise<SessionUser | null> => {
  return sessionUserFromHeaders(await headers());
});

/** Current request's user; throws `UNAUTHENTICATED` when signed out. */
export async function getSessionUser(): Promise<SessionUser> {
  const user = await getOptionalSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to continue");
  return user;
}
