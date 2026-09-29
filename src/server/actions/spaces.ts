"use server";

import { createSpace } from "../services/spaces";
import { action } from "./action";
import { createSpaceSchema } from "./spaces.schema";

/** Returns `{ spaceId }`; the client navigates to `/s/<spaceId>`, which lands in its first list. */
export const createSpaceAction = action(createSpaceSchema, (input, ctx) => createSpace(ctx, input));
