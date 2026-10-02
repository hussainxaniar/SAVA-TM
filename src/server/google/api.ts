import { google, type calendar_v3 } from "googleapis";

/*
 * The only module that talks to Google (Section 10). Services call through the `googleApi` object
 * so tests can replace its methods (vi.spyOn) and never hit the network.
 */

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const SCOPES = ["openid", "email", CALENDAR_SCOPE];

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string;
  email: string | null;
};

export type EventBody = calendar_v3.Schema$Event;

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error("Google Calendar needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_URL");
  }
  return { clientId, clientSecret, redirectUri: `${appUrl.replace(/\/$/, "")}/api/google/callback` };
}

function oauthClient() {
  const { clientId, clientSecret, redirectUri } = config();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function calendarClient(accessToken: string) {
  const auth = oauthClient();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

/** HTTP status of a Google API error, if any. */
export function googleStatus(error: unknown): number | undefined {
  const e = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  const status = e?.response?.status ?? e?.status ?? e?.code;
  return typeof status === "number" ? status : undefined;
}

/** True when Google says the refresh token is no longer valid (revoked, expired, 7-day test limit). */
export function isInvalidGrant(error: unknown): boolean {
  const e = error as { response?: { data?: { error?: unknown } }; message?: unknown };
  return e?.response?.data?.error === "invalid_grant" || (typeof e?.message === "string" && e.message.includes("invalid_grant"));
}

export const googleApi = {
  configured(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL);
  },

  authUrl(state: string): string {
    return oauthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: SCOPES,
      state,
    });
  },

  async exchangeCode(code: string): Promise<GoogleTokens> {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    let email: string | null = null;
    if (tokens.id_token) {
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config().clientId });
      email = ticket.getPayload()?.email ?? null;
    }
    return {
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_500_000),
      scope: tokens.scope ?? "",
      email,
    };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    return {
      accessToken: credentials.access_token ?? "",
      expiresAt: new Date(credentials.expiry_date ?? Date.now() + 3_500_000),
    };
  },

  async revoke(token: string): Promise<void> {
    await oauthClient().revokeToken(token);
  },

  async insertEvent(accessToken: string, calendarId: string, body: EventBody): Promise<{ id: string; etag: string | null }> {
    const res = await calendarClient(accessToken).events.insert({ calendarId, requestBody: body });
    return { id: res.data.id!, etag: res.data.etag ?? null };
  },

  async patchEvent(accessToken: string, calendarId: string, eventId: string, body: EventBody): Promise<{ etag: string | null }> {
    const res = await calendarClient(accessToken).events.patch({ calendarId, eventId, requestBody: body });
    return { etag: res.data.etag ?? null };
  },

  /** All events overlapping the range, recurring ones expanded, cancelled ones included (10.4). */
  async listEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string): Promise<EventBody[]> {
    const calendar = calendarClient(accessToken);
    const items: EventBody[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 4; page++) {
      const res = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        showDeleted: true,
        maxResults: 250,
        pageToken,
      });
      items.push(...(res.data.items ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }
    return items;
  },

  /** One event, or null when it's gone (404/410). */
  async getEvent(accessToken: string, calendarId: string, eventId: string): Promise<EventBody | null> {
    try {
      const res = await calendarClient(accessToken).events.get({ calendarId, eventId });
      return res.data;
    } catch (e) {
      const status = googleStatus(e);
      if (status === 404 || status === 410) return null;
      throw e;
    }
  },

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    await calendarClient(accessToken).events.delete({ calendarId, eventId });
  },
};
