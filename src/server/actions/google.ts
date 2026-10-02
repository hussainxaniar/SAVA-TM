"use server";

import { refresh } from "next/cache";
import { disconnectGoogle, getGoogleAuthUrl, getGoogleConnection, listGoogleEvents } from "../services/google-calendar";
import { action } from "./action";
import { authUrlSchema, empty, eventsRangeSchema } from "./google.schema";

// Google Calendar connection (Section 10.2). Connecting itself is a redirect to Google and back
// through /api/google/callback.

export const getGoogleConnectionAction = action(empty, (_input, ctx) => getGoogleConnection(ctx));
export const getGoogleAuthUrlAction = action(authUrlSchema, (input, ctx) => getGoogleAuthUrl(ctx, input));
export const disconnectGoogleAction = action(empty, async (_input, ctx) => {
  await disconnectGoogle(ctx);
  refresh();
});

/** The visible range's other Google events, after reconciling my blocks with Google (10.4). */
export const listGoogleEventsAction = action(eventsRangeSchema, (input, ctx) => listGoogleEvents(ctx, input));
