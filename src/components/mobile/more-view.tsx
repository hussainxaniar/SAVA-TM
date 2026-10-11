"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconBell,
  IconCalendar,
  IconChevronRight,
  IconLogout,
  IconPlus,
  IconSelector,
  IconSettings,
  IconSparkles,
  IconSun,
} from "@tabler/icons-react";
import { CreateSpaceForm } from "@/components/onboarding/create-space-form";
import { Avatar } from "@/components/tasks/avatar-stack";
import { BottomSheet, BottomSheetOption } from "@/components/ui/bottom-sheet";
import { useGoogleConnection } from "@/hooks/use-calendar";
import { useUnreadCount } from "@/hooks/use-notifications";
import { authClient } from "@/lib/auth-client";
import { applyThemePreference, readThemePreference, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { SpaceSummaryDTO } from "@/server/services/types";

const ROLE_LABEL: Record<SpaceSummaryDTO["role"], string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

const THEME_LABEL: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const ROW = "flex h-[52px] w-full items-center gap-3 pl-3.5 pr-3 text-left text-base text-foreground";

/*
 * The theme preference lives in localStorage, shared with the desktop toggle (9.8). Reading it
 * through a store keeps SSR on "system" (no hydration mismatch) and re-renders when the
 * preference changes — in another tab (storage) or from this view (custom event).
 */
const THEME_EVENT = "sava:theme-change";

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/**
 * The More tab on a phone (M-06, docs/design/mobile 10): cards of rows on bg-sidebar. The space
 * card opens the spaces sheet; theme opens its own sheet; sign out clears the session.
 */
export function MoreView({
  spaceId,
  space,
  spaces,
  user,
}: {
  spaceId: string;
  space: SpaceSummaryDTO;
  spaces: SpaceSummaryDTO[];
  user: { id: string; name: string; email: string; image: string | null };
}) {
  const router = useRouter();
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeToTheme, readThemePreference, (): ThemePreference => "system");
  const unread = useUnreadCount(spaceId);
  const google = useGoogleConnection();

  const count = unread.data ?? 0;
  const connected = google.data?.connected === true;

  function pickTheme(p: ThemePreference) {
    applyThemePreference(p);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  async function onSignOut() {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <div className="min-h-full bg-sidebar">
      <div className="flex flex-col gap-4 px-4 pb-8 pt-2">
        <div className="overflow-hidden rounded-xl bg-background">
          <button
            type="button"
            onClick={() => setSpacesOpen(true)}
            className="flex h-[68px] w-full items-center gap-3 pl-3 pr-3 text-left"
          >
            <SpaceSquare
              name={space.name}
              className="size-10 rounded-[10px]"
              letterClassName="text-lg leading-6"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[17px] font-semibold leading-6 text-foreground">
                {space.name}
              </span>
              <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
                {ROLE_LABEL[space.role]}
              </span>
            </span>
            <IconSelector aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl bg-background">
          <Link href={`/s/${spaceId}/notifications`} className={ROW}>
            <IconBell aria-hidden className="size-[22px] shrink-0 text-icon" stroke={1.8} />
            <span className="min-w-0 flex-1 truncate">Notifications</span>
            {count > 0 && (
              <span className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-overdue px-1.5 text-xs font-semibold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
            <IconChevronRight aria-hidden className="size-[18px] shrink-0 text-faint" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl bg-background">
          <Link href={`/s/${spaceId}/settings`} className={cn(ROW, "border-b border-divider")}>
            <IconSettings aria-hidden className="size-[22px] shrink-0 text-icon" stroke={1.8} />
            <span className="min-w-0 flex-1 truncate">Settings</span>
            <IconChevronRight aria-hidden className="size-[18px] shrink-0 text-faint" />
          </Link>
          <button type="button" onClick={() => setThemeOpen(true)} className={ROW}>
            <IconSun aria-hidden className="size-[22px] shrink-0 text-icon" stroke={1.8} />
            <span className="min-w-0 flex-1 truncate">Theme</span>
            <span className="shrink-0 text-[15px] text-muted-foreground">{THEME_LABEL[theme]}</span>
            <IconChevronRight aria-hidden className="size-[18px] shrink-0 text-faint" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="px-3.5 text-xs font-semibold uppercase leading-4 tracking-[0.04em] text-muted-foreground">
            Integrations
          </p>
          <div className="overflow-hidden rounded-xl bg-background">
            <Link href={`/s/${spaceId}/integrations`} className={cn(ROW, "border-b border-divider")}>
              <IconCalendar aria-hidden className="size-[22px] shrink-0 text-icon" stroke={1.8} />
              <span className="min-w-0 flex-1 truncate">Google Calendar</span>
              <span
                className={cn("shrink-0 text-[15px]", connected ? "text-success" : "text-muted-foreground")}
              >
                {connected ? "Connected" : "Not connected"}
              </span>
              <IconChevronRight aria-hidden className="size-[18px] shrink-0 text-faint" />
            </Link>
            <Link href={`/s/${spaceId}/integrations`} className={ROW}>
              <IconSparkles aria-hidden className="size-[22px] shrink-0 text-icon" stroke={1.8} />
              <span className="min-w-0 flex-1 truncate">AI access</span>
              <IconChevronRight aria-hidden className="size-[18px] shrink-0 text-faint" />
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-background">
          <div className="flex h-[60px] items-center gap-3 border-b border-divider pl-3.5 pr-3">
            <Avatar user={user} className="size-8 shrink-0 text-xs" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base leading-[22px] text-foreground">{user.name}</span>
              <span className="truncate text-xs leading-4 text-muted-foreground">{user.email}</span>
            </span>
          </div>
          <button type="button" onClick={() => void onSignOut()} className={cn(ROW, "text-overdue")}>
            <IconLogout aria-hidden className="size-[22px] shrink-0" stroke={1.8} />
            <span className="min-w-0 flex-1 truncate">Sign out</span>
          </button>
        </div>
      </div>

      <BottomSheet open={spacesOpen} onOpenChange={setSpacesOpen} title="Spaces">
        {spaces.map((s) => (
          <BottomSheetOption
            key={s.id}
            selected={s.id === spaceId}
            className="min-h-[60px]"
            icon={
              <SpaceSquare
                name={s.name}
                className="size-9 rounded-[9px]"
                letterClassName="text-base leading-[22px]"
              />
            }
            onClick={() => {
              setSpacesOpen(false);
              router.push(`/s/${s.id}`);
            }}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-base leading-[22px]">{s.name}</span>
              <span className="truncate text-xs leading-4 text-muted-foreground">{ROLE_LABEL[s.role]}</span>
            </span>
          </BottomSheetOption>
        ))}
        <div className="border-t border-divider">
          <BottomSheetOption
            icon={<IconPlus aria-hidden className="size-5 text-muted-foreground" />}
            onClick={() => {
              setSpacesOpen(false);
              setCreateOpen(true);
            }}
          >
            Create a space
          </BottomSheetOption>
        </div>
      </BottomSheet>

      <BottomSheet open={themeOpen} onOpenChange={setThemeOpen} title="Theme">
        {(["light", "dark", "system"] as const).map((p) => (
          <BottomSheetOption
            key={p}
            selected={theme === p}
            onClick={() => {
              pickTheme(p);
              setThemeOpen(false);
            }}
          >
            {THEME_LABEL[p]}
          </BottomSheetOption>
        ))}
      </BottomSheet>

      <BottomSheet open={createOpen} onOpenChange={setCreateOpen} title="Create a space">
        <div className="p-4">
          <CreateSpaceForm />
        </div>
      </BottomSheet>
    </div>
  );
}

/** A space's letter square: 40px on the card, 36px in the switcher sheet. */
function SpaceSquare({
  name,
  className,
  letterClassName,
}: {
  name: string;
  className: string;
  letterClassName: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("flex items-center justify-center bg-foreground text-background", className)}
    >
      <span className={cn("font-semibold", letterClassName)}>{name.trim().charAt(0).toUpperCase()}</span>
    </span>
  );
}
