import { beforeAll, describe, expect, it } from "vitest";
import { auth, sessionUserFromHeaders } from "@/server/auth";
import { db } from "@/server/db";
import { resetDb } from "../helpers/db";

// Exercises the real Better Auth config against our Prisma schema (Section 7.1).

const password = "correct-horse";

function cookieHeader(headers: Headers): Headers {
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function signUp(email: string, pw = password) {
  const { headers } = await auth.api.signUpEmail({ body: { name: "Tess", email, password: pw }, returnHeaders: true });
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
