"use client";

import { IconBellRinging } from "@tabler/icons-react";
import { PushSwitch, pushHint } from "@/components/notifications/push-switch";
import { usePush } from "@/hooks/use-push";

/*
 * "Notifications on this device" on the desktop Integrations page (I-21a), same card frame as the
 * Google Calendar card. Nothing renders while the server has no push keys.
 */
export function PushCard() {
  const { state } = usePush();
  if (state === "unconfigured") return null;
  const hint = pushHint(state);
  const on = state === "on";
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <IconBellRinging className="size-5 text-foreground/80" aria-hidden />
        Notifications on this device
      </h2>
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">
          Get a notification on this device when someone assigns you a task, comments, or changes a status or due
          date, even when Sava TM is closed.
        </p>
        {hint ? (
          <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <PushSwitch />
            <span className="text-sm text-muted-foreground">{on ? "On" : "Off"}</span>
          </div>
        )}
      </div>
    </section>
  );
}