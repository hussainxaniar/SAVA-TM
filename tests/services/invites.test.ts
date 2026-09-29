import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  acceptInvite,
  createInvite,
  getInvite,
  INVITE_MESSAGES,
  listInvites,
  revokeInvite,
} from "@/server/services/spaces";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
const tokenOf = (url: string) => url.split("/invite/")[1];

async function setup() {
  return makeSpace({ owner: "OWNER", admin: "ADMIN", member: "MEMBER" });
}

describe("createInvite", () => {
  it("lets an Admin create a link with role, expiry and max uses", async () => {
    const s = await setup();
    const before = Date.now();
    const { url, invite } = await createInvite(as(s.users.admin.id), {
      spaceId: s.space.id,
      role: "ADMIN",
      expiresInDays: 7,
      maxUses: 3,
    });
    expect(url).toMatch(/^http:\/\/localhost:3000\/invite\/[A-Za-z0-9_-]{43}$/);
    expect(invite).toMatchObject({ url, role: "ADMIN", uses: 0, maxUses: 3, status: "ACTIVE" });
    const expires = new Date(invite.expiresAt).getTime();
    expect(expires - before).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
    expect(expires - before).toBeLessThan(7 * 86_400_000 + 60_000);
  });

  it("rejects Owner invites, odd expiries and bad max uses", async () => {
    const s = await setup();
    const ctx = as(s.users.owner.id);
    const base = { spaceId: s.space.id, role: "MEMBER" as const, expiresInDays: 7 };
    await expect(createInvite(ctx, { ...base, role: "OWNER" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createInvite(ctx, { ...base, expiresInDays: 3 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createInvite(ctx, { ...base, maxUses: 0 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createInvite(ctx, { ...base, maxUses: 1.5 })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("is Admin-only, as are listing and revoking", async () => {
    const s = await setup();
    const { invite } = await createInvite(as(s.users.owner.id), { spaceId: s.space.id, role: "MEMBER", expiresInDays: 1 });
    const m = as(s.users.member.id);
    await expect(
      createInvite(m, { spaceId: s.space.id, role: "MEMBER", expiresInDays: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listInvites(m, { spaceId: s.space.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(revokeInvite(m, { inviteId: invite.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("listInvites / revokeInvite", () => {
  it("lists live links newest first with status, and hides revoked ones", async () => {
    const s = await setup();
    const ctx = as(s.users.owner.id);
    const a = await createInvite(ctx, { spaceId: s.space.id, role: "MEMBER", expiresInDays: 1 });
    const b = await createInvite(ctx, { spaceId: s.space.id, role: "MEMBER", expiresInDays: 1, maxUses: 1 });
    const c = await createInvite(ctx, { spaceId: s.space.id, role: "ADMIN", expiresInDays: 30 });
    await db.invite.update({ where: { id: a.invite.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await db.invite.update({ where: { id: b.invite.id }, data: { uses: 1 } });
    await revokeInvite(ctx, { inviteId: c.invite.id });
    await revokeInvite(ctx, { inviteId: c.invite.id }); // idempotent

    const list = await listInvites(ctx, { spaceId: s.space.id });
    expect(list.map((i) => [i.id, i.status])).toEqual([
      [b.invite.id, "USED_UP"],
      [a.invite.id, "EXPIRED"],
    ]);
  });
});

describe("getInvite", () => {
  it("shows space and role to anyone holding the token, signed out included", async () => {
    const s = await setup();
    const { url } = await createInvite(as(s.users.owner.id), { spaceId: s.space.id, role: "ADMIN", expiresInDays: 7 });
    await expect(getInvite(null, { token: tokenOf(url) })).resolves.toEqual({
      valid: true,
      spaceName: "Test space",
      role: "ADMIN",
      memberSpaceId: null,
    });
    const stranger = await makeUser();
    await expect(getInvite(as(stranger.id), { token: tokenOf(url) })).resolves.toMatchObject({ memberSpaceId: null });
    await expect(getInvite(as(s.users.member.id), { token: tokenOf(url) })).resolves.toMatchObject({
      memberSpaceId: s.space.id,
    });
  });

  it("explains unknown, expired, revoked and used-up links", async () => {
    const s = await setup();
    const ctx = as(s.users.owner.id);
    await expect(getInvite(null, { token: "nope" })).resolves.toEqual({
      valid: false,
      reason: "NOT_FOUND",
      spaceName: null,
      memberSpaceId: null,
    });
    const cases = [
      ["EXPIRED", { expiresAt: new Date(Date.now() - 1000) }],
      ["REVOKED", { revokedAt: new Date() }],
      ["USED_UP", { maxUses: 2, uses: 2 }],
    ] as const;
    for (const [reason, data] of cases) {
      const { url, invite } = await createInvite(ctx, { spaceId: s.space.id, role: "MEMBER", expiresInDays: 1 });
      await db.invite.update({ where: { id: invite.id }, data });
      await expect(getInvite(null, { token: tokenOf(url) })).resolves.toMatchObject({ valid: false, reason });
    }
  });
});

describe("acceptInvite", () => {
  it("joins with the invite's role and counts the use", async () => {
    const s = await setup();
    const { url, invite } = await createInvite(as(s.users.admin.id), {
      spaceId: s.space.id,
      role: "ADMIN",
      expiresInDays: 7,
    });
    const joiner = await makeUser();
    await expect(acceptInvite(as(joiner.id), { token: tokenOf(url) })).resolves.toEqual({ spaceId: s.space.id });
    const membership = await db.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: s.space.id, userId: joiner.id } },
    });
    expect(membership?.role).toBe("ADMIN");
    expect((await db.invite.findUniqueOrThrow({ where: { id: invite.id } })).uses).toBe(1);
  });

  it("is a no-op for existing members (no use counted, role unchanged)", async () => {
    const s = await setup();
    const { url, invite } = await createInvite(as(s.users.owner.id), {
      spaceId: s.space.id,
      role: "ADMIN",
      expiresInDays: 7,
    });
    await expect(acceptInvite(as(s.users.member.id), { token: tokenOf(url) })).resolves.toEqual({
      spaceId: s.space.id,
    });
    expect((await db.invite.findUniqueOrThrow({ where: { id: invite.id } })).uses).toBe(0);
    const m = await db.spaceMember.findUniqueOrThrow({
      where: { spaceId_userId: { spaceId: s.space.id, userId: s.users.member.id } },
    });
    expect(m.role).toBe("MEMBER");
  });

  it("refuses unknown, expired, revoked and used-up links with a clear message", async () => {
    const s = await setup();
    const ctx = as(s.users.owner.id);
    const joiner = await makeUser();
    await expect(acceptInvite(as(joiner.id), { token: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: INVITE_MESSAGES.NOT_FOUND,
    });
    const cases = [
      ["EXPIRED", { expiresAt: new Date(Date.now() - 1000) }],
      ["REVOKED", { revokedAt: new Date() }],
      ["USED_UP", { maxUses: 1, uses: 1 }],
    ] as const;
    for (const [reason, data] of cases) {
      const { url, invite } = await createInvite(ctx, { spaceId: s.space.id, role: "MEMBER", expiresInDays: 1 });
      await db.invite.update({ where: { id: invite.id }, data });
      await expect(acceptInvite(as(joiner.id), { token: tokenOf(url) })).rejects.toMatchObject({
        code: "VALIDATION",
        message: INVITE_MESSAGES[reason],
      });
    }
    expect(await db.spaceMember.count({ where: { spaceId: s.space.id, userId: joiner.id } })).toBe(0);
  });

  it("never exceeds maxUses under concurrent accepts", async () => {
    const s = await setup();
    const { url, invite } = await createInvite(as(s.users.owner.id), {
      spaceId: s.space.id,
      role: "MEMBER",
      expiresInDays: 1,
      maxUses: 1,
    });
    const joiners = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser()));
    const results = await Promise.allSettled(joiners.map((j) => acceptInvite(as(j.id), { token: tokenOf(url) })));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.invite.findUniqueOrThrow({ where: { id: invite.id } })).uses).toBe(1);
    expect(await db.spaceMember.count({ where: { spaceId: s.space.id, userId: { in: joiners.map((j) => j.id) } } })).toBe(1);
  });
});
