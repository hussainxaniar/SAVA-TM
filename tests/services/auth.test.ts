import { beforeAll, describe, expect, it } from "vitest";
import { auth, sessionUserFromHeaders } from "@/server/auth";
import { db } from "@/server/db";
import { createInvite, revokeInvite, signUpAllowed } from "@/server/services/spaces";
import { INVITE_COOKIE } from "@/lib/invite-cookie";
import { makeSpace, resetDb } from "../helpers/db";

// Exercises the real Better Auth config against our Prisma schema (Section 7.1).

const password = "correct-horse";

function cookieHeader(headers: Headers): Headers {
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function signUp(email: string, pw = password, inviteToken?: string) {
  const { headers } = await auth.api.signUpEmail({
    body: { name: "Tess", email, password: pw },
    headers: new Headers(inviteToken ? { cookie: `${INVITE_COOKIE}=${inviteToken}` } : {}),
    returnHeaders: true,
  });
  return cookieHeader(headers);
}

beforeAll(resetDb);

describe("email/password auth", () => {
  it("sign-up creates the user, a credential account and a session", async () => {
    const cookies = await signUp("tess@test.local");
    await expect(sessionUserFromHeaders(cookies)).resolves.toMatchObject({
      name: "Tess",
      email: "tess@test.local",
      image: null,
    });
    const user = await db.user.findUniqueOrThrow({ where: { email: "tess@test.local" }, include: { accounts: true } });
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]).toMatchObject({ providerId: "credential" });
    expect(user.accounts[0].password).not.toBe(password);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    await expect(signUp("short@test.local", "1234567")).rejects.toThrow();
    await expect(db.user.findUnique({ where: { email: "short@test.local" } })).resolves.toBeNull();
  });

  it("rejects a duplicate email", async () => {
    await expect(signUp("tess@test.local")).rejects.toThrow();
  });

  it("signs in with the right password only", async () => {
    await expect(auth.api.signInEmail({ body: { email: "tess@test.local", password: "wrong-password" } })).rejects.toThrow();
    const { headers } = await auth.api.signInEmail({
      body: { email: "tess@test.local", password },
      returnHeaders: true,
    });
    await expect(sessionUserFromHeaders(cookieHeader(headers))).resolves.toMatchObject({ email: "tess@test.local" });
  });

  it("sign-out ends the session", async () => {
    const { headers } = await auth.api.signInEmail({ body: { email: "tess@test.local", password }, returnHeaders: true });
    const cookies = cookieHeader(headers);
    await auth.api.signOut({ headers: cookies });
    await expect(sessionUserFromHeaders(cookies)).resolves.toBeNull();
  });

  it("returns null with no or a bogus session cookie", async () => {
    await expect(sessionUserFromHeaders(new Headers())).resolves.toBeNull();
    await expect(
      sessionUserFromHeaders(new Headers({ cookie: "better-auth.session_token=forged.value" })),
    ).resolves.toBeNull();
  });
});

describe("invite-only sign-up (7.2.6)", () => {
  // Runs after the block above, so the database already has an account (the first one needed no invite).
  async function invite(expiresInDays = 7, maxUses: number | null = null) {
    const s = await makeSpace({ admin: "ADMIN" });
    const { url, invite } = await createInvite({ userId: s.users.admin.id }, { spaceId: s.space.id, role: "MEMBER", expiresInDays, maxUses });
    return { token: url.split("/invite/")[1], inviteId: invite.id, adminId: s.users.admin.id };
  }

  it("refuses a new account without an invite", async () => {
    await expect(signUp("nobody@test.local")).rejects.toThrow(/invite only/);
    await expect(signUp("bogus@test.local", password, "not-a-real-token")).rejects.toThrow(/invite only/);
    await expect(db.user.findUnique({ where: { email: "nobody@test.local" } })).resolves.toBeNull();
  });

  it("creates the account when the request carries a usable invite", async () => {
    const { token } = await invite();
    const cookies = await signUp("invited@test.local", password, token);
    await expect(sessionUserFromHeaders(cookies)).resolves.toMatchObject({ email: "invited@test.local" });
  });

  it("refuses revoked, used-up and expired invites", async () => {
    const revoked = await invite();
    await revokeInvite({ userId: revoked.adminId }, { inviteId: revoked.inviteId });
    await expect(signUp("revoked@test.local", password, revoked.token)).rejects.toThrow(/invite only/);

    const usedUp = await invite(7, 1);
    await db.invite.update({ where: { id: usedUp.inviteId }, data: { uses: 1 } });
    await expect(signUp("usedup@test.local", password, usedUp.token)).rejects.toThrow(/invite only/);

    const expired = await invite();
    await db.invite.update({ where: { id: expired.inviteId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(signUp("expired@test.local", password, expired.token)).rejects.toThrow(/invite only/);
  });

  it("lets existing accounts keep signing in", async () => {
    await expect(auth.api.signInEmail({ body: { email: "tess@test.local", password } })).resolves.toBeTruthy();
  });

  it("needs no invite for the first account of an empty database", async () => {
    await resetDb();
    await expect(signUpAllowed(null)).resolves.toBe(true);
    await signUp("first@test.local");
    await expect(signUpAllowed(null)).resolves.toBe(false);
  });
});
