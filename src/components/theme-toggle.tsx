"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyThemePreference, readThemePreference, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemePreference, string> = {
  system: "Theme: system (click for light)",
  light: "Theme: light (click for dark)",
  dark: "Theme: dark (click for system)",
};

let listeners: (() => void)[] = [];
const store = {
  subscribe(l: () => void) {
    listeners = [...listeners, l];
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  },
  get: readThemePreference,
  getServer: (): ThemePreference => "system",
  set(p: ThemePreference) {
    applyThemePreference(p);
    listeners.forEach((l) => l());
  },
};

/** Cycles system → light → dark (9.8: system by default). */
export function ThemeToggle({ className }: { className?: string }) {
  const pref = useSyncExternalStore(store.subscribe, store.get, store.getServer);
  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      aria-label={LABEL[pref]}
      title={LABEL[pref]}
      onClick={() => store.set(NEXT[pref])}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
