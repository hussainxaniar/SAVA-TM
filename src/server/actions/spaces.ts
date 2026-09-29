"use server";

import { refresh } from "next/cache";
import {
  acceptInvite,
  changeRole,
  createInvite,
  createSpace,
  leaveSpace,
  removeMember,
  renameSpace,
  revokeInvite,
} from "../services/spaces";
import { action } from "./action";
import {
  acceptInviteSchema,
  changeRoleSchema,
  createInviteSchema,
  createSpaceSchema,
  leaveSpaceSchema,
  removeMemberSchema,
  renameSpaceSchema,
  revokeInviteSchema,
} from "./spaces.schema";

// Settings mutations call refresh() so the current page re-renders with fresh server data;
// client components don't refetch or patch state themselves.

/** Returns `{ spaceId }`; the client navigates to `/s/<spaceId>`, which lands in its first list. */
export const createSpaceAction = action(createSpaceSchema, (input, ctx) => createSpace(ctx, input));

export const renameSpaceAction = action(renameSpaceSchema, async (input, ctx) => {
  await renameSpace(ctx, input);
  refresh();
});

export const changeRoleAction = action(changeRoleSchema, async (input, ctx) => {
  await changeRole(ctx, input);
  refresh();
});

export const removeMemberAction = action(removeMemberSchema, async (input, ctx) => {
  await removeMember(ctx, input);
  refresh();
});

/** The caller is no longer a member afterwards; the client navigates to "/". */
export const leaveSpaceAction = action(leaveSpaceSchema, (input, ctx) => leaveSpace(ctx, input));

/** Returns `{ url, invite }` so the new link can be copied right away. */
export const createInviteAction = action(createInviteSchema, async (input, ctx) => {
  const result = await createInvite(ctx, input);
  refresh();
  return result;
});

export const revokeInviteAction = action(revokeInviteSchema, async (input, ctx) => {
  await revokeInvite(ctx, input);
  refresh();
});

/** Returns `{ spaceId }`; the client navigates to `/s/<spaceId>`. */
export const acceptInviteAction = action(acceptInviteSchema, (input, ctx) => acceptInvite(ctx, input));
