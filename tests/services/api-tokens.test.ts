import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  MAX_LIVE_TOKENS,
  TOKEN_PREFIX,
  createApiToken,
  hashToken,
  listApiTokens,
  resolveApiToken,
  revokeApiToken,
} from "@/server/services/api-tokens";
import { removeMember } from "@/server/services/spaces";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
let s: Awaited<ReturnType<typeof makeSpace<"owner" | "admin" | "member" | "other">>>;
const create = (userId: string, over: Partial<Parameters<typeof createApiToken>[1]> = {}) =>
  createApiToken(as(userId), { spaceId: s.space.id, name: "Claude", scope: "WRITE", expiresInDays: 90, ...over });

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", admin: "ADMIN", member: "MEMBER", other: "MEMBER" });
});

describe("createApiToken", () => {
  it("returns the secret once and stores only its hash and display prefix", async () => {
    const { id, token, prefix } = await create(s.users.member.id);
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    expect(prefix).toBe(token.slice(0, 12));
    const row = await db.apiToken.findUniqueOrThrow({ where: { id } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row).toMatchObject({ userId: s.users.member.id, spaceId: s.space.id, scope: "WRITE", name: "Claude" });
    expect(row.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 89 * 86_400_000);
  });

  it("never expires with expiresInDays null, and rejects odd lifetimes, empty names and non-members", async () => {
    const { id } = await create(s.users.member.id, { expiresInDays: null });
    expect((await db.apiToken.findUniqueOrThrow({ where: { id } })).expiresAt).toBeNull();
    await expect(create(s.users.member.id, { expiresInDays: 7 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(create(s.users.member.id, { name: "  " })).rejects.toMatchObject({ code: "VALIDATION" });
    const stranger = await makeUser("Stranger");
    await expect(create(stranger.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows at most 10 live tokens per user and space; revoked ones don't count", async () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_LIVE_TOKENS; i++) ids.push((await create(s.users.member.id, { name: `t${i}` })).id);
    await expect(create(s.users.member.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await revokeApiToken(as(s.users.member.id), { tokenId: ids[0] });
    await expect(create(s.users.member.id)).resolves.toBeTruthy();
    // Another member is unaffected.
    await expect(create(s.users.other.id)).resolves.toBeTruthy();
  });
});

describe("resolveApiToken", () => {
  it("resolves a live token to its user, space and scope and stamps lastUsedAt (throttled)", async () => {
    const { id, token } = await create(s.users.member.id, { scope: "READ" });
    const t0 = new Date(Date.now() + 1000); // inside the 90-day lifetime
    await expect(resolveApiToken(token, new Date(t0))).resolves.toEqual({
      tokenId: id,
      userId: s.users.member.id,
      spaceId: s.space.id,
      scope: "READ",
    });
    expect((await db.apiToken.findUniqueOrThrow({ where: { id } })).lastUsedAt).toEqual(t0);
    await resolveApiToken(token, new Date(t0.getTime() + 10_000));
    expect((await db.apiToken.findUniqueOrThrow({ where: { id } })).lastUsedAt).toEqual(t0); // within a minute: not rewritten
    const later = new Date(t0.getTime() + 120_000);
    await resolveApiToken(token, later);
    expect((await db.apiToken.findUniqueOrThrow({ where: { id } })).lastUsedAt).toEqual(later);
  });

  it("rejects unknown, malformed, revoked and expired tokens", async () => {
    const { id, token } = await create(s.users.member.id, { expiresInDays: 30 });
    await expect(resolveApiToken("nope")).resolves.toBeNull();
    await expect(resolveApiToken(TOKEN_PREFIX + "x".repeat(40))).resolves.toBeNull();
    await expect(resolveApiToken(token, new Date(Date.now() + 31 * 86_400_000))).resolves.toBeNull();
    await expect(resolveApiToken(token)).resolves.not.toBeNull();
    await revokeApiToken(as(s.users.member.id), { tokenId: id });
    await expect(resolveApiToken(token)).resolves.toBeNull();
  });

  it("stops working when the user is removed from the space", async () => {
    const { token } = await create(s.users.member.id);
    await removeMember(as(s.users.owner.id), { spaceId: s.space.id, userId: s.users.member.id });
    await expect(resolveApiToken(token)).resolves.toBeNull();
  });
});

describe("listApiTokens and revokeApiToken", () => {
  it("members see their own tokens; Owner and Admin see everyone's; revoked tokens are hidden", async () => {
    const mine = await create(s.users.member.id, { name: "mine" });
    await create(s.users.other.id, { name: "theirs" });
    const memberView = await listApiTokens(as(s.users.member.id), { spaceId: s.space.id });
    expect(memberView.map((t) => t.name)).toEqual(["mine"]);
    expect(memberView[0]).toMatchObject({ mine: true, prefix: mine.prefix, scope: "WRITE", expired: false });
    expect(JSON.stringify(memberView)).not.toContain(mine.token);

    const adminView = await listApiTokens(as(s.users.admin.id), { spaceId: s.space.id });
    expect(adminView.map((t) => t.name).sort()).toEqual(["mine", "theirs"]);
    expect(adminView.find((t) => t.name === "theirs")!.mine).toBe(false);

    await revokeApiToken(as(s.users.member.id), { tokenId: mine.id });
    expect((await listApiTokens(as(s.users.member.id), { spaceId: s.space.id }))).toEqual([]);
  });

  it("lets an Admin revoke another member's token but not a Member; revoking twice is fine", async () => {
    const t = await create(s.users.member.id);
    await expect(revokeApiToken(as(s.users.other.id), { tokenId: t.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await revokeApiToken(as(s.users.admin.id), { tokenId: t.id });
    await revokeApiToken(as(s.users.admin.id), { tokenId: t.id });
    await expect(resolveApiToken(t.token)).resolves.toBeNull();
    await expect(revokeApiToken(as(s.users.admin.id), { tokenId: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides tokens from non-members", async () => {
    const stranger = await makeUser("Stranger");
    await expect(listApiTokens(as(stranger.id), { spaceId: s.space.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
