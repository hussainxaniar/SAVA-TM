"use client";

import { createContext } from "react";

/*
 * What the server guessed about the device (true = a phone), used as `useIsMobile`'s value during
 * the server render and hydration. The real media query takes over right after, so a wrong guess
 * (a narrow desktop window, a tablet) only costs one re-render.
 */
export const MobileHintContext = createContext(false);

export function MobileHintProvider({ mobile, children }: { mobile: boolean; children: React.ReactNode }) {
  return <MobileHintContext.Provider value={mobile}>{children}</MobileHintContext.Provider>;
}
