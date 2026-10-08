"use server";

import { refresh } from "next/cache";
import { createApiToken, revokeApiToken } from "../services/api-tokens";
import { action } from "./action";
import { createApiTokenSchema, revokeApiTokenSchema } from "./api-tokens.schema";

// The Integrations page loads the token list on the server; these refresh() it after a change.

/** Returns the secret exactly once (`token`); the list shows only its prefix afterwards. */
export const createApiTokenAction = action(createApiTokenSchema, async (input, ctx) => {
  const created = await createApiToken(ctx, input);
  refresh();
  return created;
});

export const revokeApiTokenAction = action(revokeApiTokenSchema, async (input, ctx) => {
  await revokeApiToken(ctx, input);
  refresh();
});
