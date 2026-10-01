"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { IconBrandGoogle } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { googleConnectionKey } from "@/hooks/use-calendar";
import { disconnectGoogleAction, getGoogleAuthUrlAction } from "@/server/actions/google";
import type { GoogleConnectionDTO } from "@/server/services/google-calendar";

/**
 * Google Calendar on the Integrations page (10.2). Connect = a redirect to Google's consent screen
 * and back through /api/google/callback, which lands here with an outcome to toast.
 */
export function GoogleCalendarCard({
  spaceId,
  connection,
  outcome,
  message,
}: {
  spaceId: string;
  connection: GoogleConnectionDTO;
  outcome: string | null;
  message: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // The callback's outcome: toast once, then drop it from the URL.
  useEffect(() => {
    if (!outcome) return;
    if (outcome === "connected") toast.success("Google Calendar connected");
    else if (outcome === "cancelled") toast(message ?? "Google Calendar wasn't connected.");
    else toast.error(message ?? "Connecting Google Calendar failed. Try again.");
    void qc.invalidateQueries({ queryKey: googleConnectionKey });
    void qc.invalidateQueries({ queryKey: ["calendar"] });
    router.replace(pathname, { scroll: false });
  }, [outcome, message, pathname, router, qc]);

  async function connect() {
    setBusy(true);
    const res = await getGoogleAuthUrlAction({ spaceId });
    if (!res.ok) {
      toast.error(res.error.message);
      setBusy(false);
      return;
    }
    window.location.assign(res.data.url);
  }

  async function disconnect() {
    setBusy(true);
    const res = await disconnectGoogleAction({});
    setBusy(false);
    setConfirmOpen(false);
    if (!res.ok) return toast.error(res.error.message);
    toast.success("Google Calendar disconnected");
    void qc.invalidateQueries({ queryKey: googleConnectionKey });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Calendar</h2>
      <div className="flex items-start gap-4 rounded-lg border p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-pill">
          <IconBrandGoogle className="size-5 text-foreground/80" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Google Calendar</p>
          {connection.connected ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Connected as <span className="text-foreground">{connection.email || "your Google account"}</span> · calendar{" "}
              <span className="text-foreground">{connection.calendarId === "primary" ? "Primary" : connection.calendarId}</span>.
              Your scheduled time blocks appear there as events.
            </p>
          ) : connection.configured ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Put your scheduled time blocks on your Google Calendar. Sava only reads and writes events, nothing else.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">Not set up on this server yet (Google OAuth credentials are missing).</p>
          )}
        </div>
        {connection.connected ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmOpen(true)}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" disabled={busy || !connection.configured} onClick={() => void connect()}>
            Connect Google Calendar
          </Button>
        )}
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              New and changed time blocks stop syncing. Events already on your calendar stay there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void disconnect();
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
