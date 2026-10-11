import webpush from "web-push";

/*
 * The only module that talks to the browsers' push services (Section 17). Services call through
 * the `pushApi` object so tests can replace its methods (vi.spyOn) and never hit the network.
 * Configured by VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT ("mailto:…" or the app URL).
 */

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** What the service worker receives (public/sw.js). */
export type PushPayload = { title: string; body: string; url: string; tag: string };

function keys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || process.env.APP_URL;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export const pushApi = {
  isConfigured(): boolean {
    return keys() !== null;
  },

  /** The key a browser subscribes with (safe to send to the client). */
  publicKey(): string | null {
    return keys()?.publicKey ?? null;
  },

  /**
   * Sends one notification to one device. "gone": the push service says the subscription no
   * longer exists (the user removed the permission or the app), so it should be deleted.
   * Any other failure throws.
   */
  async send(target: PushTarget, payload: PushPayload): Promise<"sent" | "gone"> {
    const vapid = keys();
    if (!vapid) throw new Error("Web push needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY");
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        // TTL: a device that is offline gets it for a day, then it only lives in the bell.
        { vapidDetails: vapid, TTL: 60 * 60 * 24, urgency: "normal" },
      );
      return "sent";
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      throw e;
    }
  },
};
