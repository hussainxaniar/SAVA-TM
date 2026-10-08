import { createHash, randomBytes } from "node:crypto";
import type { ApiTokenScope } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../errors";
import { PERMISSIONS, hasRole, requireMember } from "../guards";
import { cleanName } from "./util";
import type { ApiTokenDTO, Ctx } from "./types";

/*
 * Section 15.2 / 15.3. Personal API tokens: one user, one space, READ or WRITE. The secret is
 * returned once by createApiToken; only its SHA-256 is stored (the secret is 32 random bytes,
 * so a fast hash is right). Revocation is a timestamp, never a delete, so the list can still
 * explain why a client stopped working.
 */

export const TOKEN_PREFIX = "sava_pat_";
export const MAX_LIVE_TOKENS = 10;
const NAME_MAX = 60;
const DISPLAY_PREFIX_LENGTH = 12;
const LAST_USED_THROTTLE_MS = 60_000;
const DAY_MS = 86_400_000;

export const TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const live = (now: Date) => ({ revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

/** Creates a token for the caller in `spaceId`. `expiresInDays: null` never expires. The secret is in the result only. */
export async function createApiToken(
  ctx: Ctx,
  input: { spaceId: string; name: string; scope: ApiTokenScope; expiresInDays: number | null },
): Promise<{ id: string; token: string; prefix: string }> {
  await requireMember(ctx.userId, input.spaceId);
  const name = cleanName(input.name, "Token name", NAME_MAX);
  if (input.expiresInDays !== null && !(TOKEN_EXPIRY_DAYS as readonly number[]).includes(input.expiresInDays)) {
    throw new AppError("VALIDATION", "Choose 30 days, 90 days, 1 year or never");
  }
  const now = new Date();
  const count = await db.apiToken.count({ where: { userId: ctx.userId, spaceId: input.spaceId, ...live(now) } });
  if (count >= MAX_LIVE_TOKENS) {
    throw new AppError("CONFLICT", `You can have at most ${MAX_LIVE_TOKENS} active tokens in a space. Revoke one first.`);
  }

  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const prefix = token.slice(0, DISPLAY_PREFIX_LENGTH);
  const row = await db.apiToken.create({
    data: {
      userId: ctx.userId,
      spaceId: input.spaceId,
      name,
      prefix,
      tokenHash: hashToken(token),
      scope: input.scope,
      expiresAt: input.expiresInDays === null ? null : new Date(now.getTime() + input.expiresInDays * DAY_MS),
    },
    select: { id: true },
  });
  return { id: row.id, token, prefix };
}

/** The caller's tokens in the space (revoked ones hidden); Owner/Admin see every member's. */
export async function listApiTokens(ctx: Ctx, input: { spaceId: string }): Promise<ApiTokenDTO[]> {
  const member = await requireMember(ctx.userId, input.spaceId);
  const seeAll = hasRole(member.role, PERMISSIONS.manageInvites);
  const now = new Date();
  const rows = await db.apiToken.findMany({
    where: { spaceId: input.spaceId, revokedAt: null, ...(seeAll ? {} : { userId: ctx.userId }) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      scope: true,
      prefix: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    scope: r.scope,
    prefix: r.prefix,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    expired: r.expiresAt !== null && r.expiresAt <= now,
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    owner: r.user,
    mine: r.userId === ctx.userId,
  }));
}

/** Own tokens, or any token in the space for an Owner/Admin. Revoking twice is a no-op. */
export async function revokeApiToken(ctx: Ctx, input: { tokenId: string }): Promise<void> {
  const token = await db.apiToken.findUnique({ where: { id: input.tokenId }, select: { userId: true, spaceId: true, revokedAt: true } });
  if (!token) throw new AppError("NOT_FOUND", "Token not found");
  const member = await requireMember(ctx.userId, token.spaceId);
  if (token.userId !== ctx.userId && !hasRole(member.role, PERMISSIONS.manageInvites)) {
    throw new AppError("NOT_FOUND", "Token not found"); // not theirs: don't confirm it exists
  }
  if (token.revokedAt) return;
  await db.apiToken.update({ where: { id: input.tokenId }, data: { revokedAt: new Date() } });
}

export type ResolvedToken = { tokenId: string; userId: string; spaceId: string; scope: ApiTokenScope };

/**
 * The token behind a raw Bearer secret, or null when it is unknown, malformed, revoked or
 * expired, or its user is no longer a member of the space (removed members lose access at once).
 * `lastUsedAt` is written at most once a minute.
 */
export async function resolveApiToken(raw: string, now = new Date()): Promise<ResolvedToken | null> {
  if (!raw.startsWith(TOKEN_PREFIX) || raw.length > 200) return null;
  const row = await db.apiToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt <= now) return null;
  const member = await db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: row.spaceId, userId: row.userId } } });
  if (!member) return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    await db.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  }
  return { tokenId: row.id, userId: row.userId, spaceId: row.spaceId, scope: row.scope };
}
