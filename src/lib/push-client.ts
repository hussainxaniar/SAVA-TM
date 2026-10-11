/*
 * Browser side of web push (blueprint Section 17): what this device can do, and the calls that
 * subscribe and unsubscribe it. The pure parts (`pushState`, `vapidKeyBytes`) are unit-tested;
 * the rest only runs in a browser.
 */

export type PushState =
  /** The server has no VAPID keys: the switch is not shown. */
  | "unconfigured"
  /** This browser has no web push at all. */
  | "unsupported"
  /** An iPhone or iPad in a browser tab: iOS only delivers push to the home screen app. */
  | "needs-install"
  /** The user (or the browser) blocked notifications for this site. */
  | "blocked"
  | "off"
  | "on";

export type PushDevice = {
  supported: boolean;
  ios: boolean;
  standalone: boolean;
  permission: "default" | "granted" | "denied";
  subscribed: boolean;
};

export function pushState(configured: boolean, device: PushDevice): PushState {
  if (!configured) return "unconfigured";
  // First: Safari in a tab has no PushManager, so "unsupported" would hide the real reason.
  if (device.ios && !device.standalone) return "needs-install";
  if (!device.supported) return "unsupported";
  if (device.permission === "denied") return "blocked";
  return device.subscribed && device.permission === "granted" ? "on" : "off";
}

/** The VAPID public key (URL-safe base64) as the bytes `pushManager.subscribe` wants. */
export function vapidKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// ---------- Browser only ----------

const SW_URL = "/sw.js";

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  return (await registration?.pushManager?.getSubscription()) ?? null;
}

export async function readPushDevice(): Promise<PushDevice> {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return {
    supported,
    ios,
    standalone,
    permission: supported ? Notification.permission : "default",
    subscribed: supported ? (await currentSubscription()) !== null : false,
  };
}

export type SubscriptionKeys = { endpoint: string; p256dh: string; auth: string; userAgent: string };

function keysOf(subscription: PushSubscription): SubscriptionKeys | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth, userAgent: navigator.userAgent.slice(0, 300) };
}

/** This device's subscription, if it already has one (to re-save it for the signed-in user). */
export async function existingSubscription(): Promise<SubscriptionKeys | null> {
  const subscription = await currentSubscription();
  return subscription ? keysOf(subscription) : null;
}

/**
 * Asks for permission (must be called from a tap) and subscribes this device.
 * Returns null when the user did not allow notifications.
 */
export async function subscribeThisDevice(publicKey: string): Promise<SubscriptionKeys | null> {
  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  if ((await Notification.requestPermission()) !== "granted") return null;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(publicKey) }));
  return keysOf(subscription);
}

/** Unsubscribes this device; returns the endpoint that was removed (to delete it on the server). */
export async function unsubscribeThisDevice(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => {});
  return endpoint;
}
