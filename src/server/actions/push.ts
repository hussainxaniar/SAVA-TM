"use server";

import { deletePushSubscription, getPushConfig, savePushSubscription } from "../services/push";
import { action } from "./action";
import { deletePushSubscriptionSchema, noInputSchema, savePushSubscriptionSchema } from "./push.schema";

// Web push actions (Section 17). A subscription is the signed-in user's own device, so the
// session (checked by `action`) is the guard; there is no space to be a member of.

export const getPushConfigAction = action(noInputSchema, async () => getPushConfig());
export const savePushSubscriptionAction = action(savePushSubscriptionSchema, (input, ctx) => savePushSubscription(ctx, input));
export const deletePushSubscriptionAction = action(deletePushSubscriptionSchema, (input, ctx) => deletePushSubscription(ctx, input));
