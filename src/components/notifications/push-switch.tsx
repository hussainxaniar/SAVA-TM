"use client";

import { usePush } from "@/hooks/use-push";
import type { PushState } from "@/lib/push-client";

/*
 * The "Notifications on this device" switch (I-21a) over usePush(). The switch only renders in
 * the states where a switch makes sense; pushHint() carries the text for the states where it
 * does not. enable() runs directly in the tap handler, because that is when the browser lets us
 * ask for permission.
 */

const HINT: Partial<Record<PushState | "loading", string>> = {
  unsupported: "This browser doesn't support notifications.",
  "needs-install": "Add Sava TM to your home screen to get notifications: tap Share, then Add to Home Screen.",
  blocked: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back.",
};

/** The explanation for `unsupported`, `needs-install` and `blocked`; null otherwise. */
export function pushHint(state: PushState | "loading"): string | null {
  return HINT[state] ?? null;
}

export function PushSwitch() {
  const { state, busy, enable, disable } = usePush();
  if (state !== "loading" && state !== "off" && state !== "on") return null;
  const on = state === "on";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Notifications on this device"
      disabled={busy || state === "loading"}
      onClick={() => (on ? disable() : enable())}
      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60 ${on ? "bg-primary" : "bg-input"}`}
    >
      <span className={`block size-6 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}