import type { SpaceRole } from "@prisma/client";

// Section 8: every service takes `ctx` first.
export type Ctx = { userId: string };

export type SpaceSummaryDTO = { id: string; name: string; icon: string | null; role: SpaceRole };

export type UserLite = { id: string; name: string; image: string | null };

export type MemberDTO = UserLite & { email: string; role: SpaceRole; joinedAt: string };

export type InviteRole = Exclude<SpaceRole, "OWNER">;

export type InviteStatus = "ACTIVE" | "EXPIRED" | "USED_UP";

/** Invites shown in Space settings (revoked ones are hidden). */
export type InviteDTO = {
  id: string;
  url: string;
  role: InviteRole;
  expiresAt: string;
  uses: number;
  maxUses: number | null;
  createdAt: string;
  status: InviteStatus;
};

export type InviteProblem = "NOT_FOUND" | "EXPIRED" | "REVOKED" | "USED_UP";

/**
 * What /invite/[token] shows. `memberSpaceId` is set only when the caller already belongs
 * to the space (7.2.4 → redirect); non-members never learn the space id.
 */
export type InviteInfoDTO =
  | { valid: true; spaceName: string; role: InviteRole; memberSpaceId: string | null }
  | { valid: false; reason: InviteProblem; spaceName: string | null; memberSpaceId: string | null };
