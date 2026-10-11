"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  existingSubscription,
  pushState,
  readPushDevice,
  subscribeThisDevice,
  unsubscribeThisDevice,
  type PushState,
} from "@/lib/push-client";
import { deletePushSubscriptionAction, getPushConfigAction, savePushSubscriptionAction } from "@/server/actions/push";
import { unwrap } from "./use-list-view";

/*
 * "Notifications on this device" (blueprint Section 17). `state` says what the switch shows (see
 * PushState); `enable()` must be called from a tap, because that is when the browser lets us ask
 * for permission. The subscription belongs to the browser, so the first render after sign-in
 * re-saves an existing one for the current user (a shared computer follows whoever is signed in).
 */

const configKey = ["push", "config"] as const;
const deviceKey = ["push", "device"] as const;

export function usePush(): { state: PushState | "loading"; busy: boolean; enable: () => void; disable: () => void } {
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: configKey,
    queryFn: async () => unwrap(await getPushConfigAction({})),
    staleTime: Infinity,
  });
  const device = useQuery({ queryKey: deviceKey, queryFn: readPushDevice, staleTime: 0 });

  const state: PushState | "loading" =
    config.data && device.data ? pushState(config.data.configured, device.data) : "loading";

  // Keep the server's row in step with this browser (once per page load).
  const synced = useRef(false);
  useEffect(() => {
    if (state !== "on" || synced.current) return;
    synced.current = true;
    void existingSubscription().then((keys) => {
      if (keys) void savePushSubscriptionAction(keys);
    });
  }, [state]);

  const enable = useMutation({
    mutationFn: async () => {
      const publicKey = config.data?.publicKey;
      if (!publicKey) throw new Error("Notifications are not set up on this server.");
      const keys = await subscribeThisDevice(publicKey);
      if (!keys) return false;
      try {
        unwrap(await savePushSubscriptionAction(keys));
      } catch (e) {
        await unsubscribeThisDevice(); // don't leave the browser subscribed to nothing
        throw e;
      }
      return true;
    },
    onSuccess: (allowed) => {
      if (!allowed) toast("Notifications were not allowed for this site.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't turn notifications on."),
    onSettled: () => qc.invalidateQueries({ queryKey: deviceKey }),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeThisDevice();
      if (endpoint) unwrap(await deletePushSubscriptionAction({ endpoint }));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't turn notifications off."),
    onSettled: () => qc.invalidateQueries({ queryKey: deviceKey }),
  });

  return {
    state,
    busy: enable.isPending || disable.isPending,
    enable: () => enable.mutate(),
    disable: () => disable.mutate(),
  };
}

/**
 * Before signing out: this device stops receiving the user's notifications. Best effort, and it
 * never blocks the sign-out.
 */
export async function removePushBeforeSignOut(): Promise<void> {
  try {
    const endpoint = await unsubscribeThisDevice();
    if (endpoint) await deletePushSubscriptionAction({ endpoint });
  } catch {
    // signing out matters more
  }
}
