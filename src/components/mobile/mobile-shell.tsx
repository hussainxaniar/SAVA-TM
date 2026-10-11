"use client";

import { TabBar } from "./tab-bar";

/** The mobile shell (M-01): a column that scrolls above the bottom tab bar. */
export function MobileShell({
  spaceId,
  children,
}: {
  spaceId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <div
        data-mobile-scroll
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)]"
      >
        {children}
      </div>
      <TabBar spaceId={spaceId} />
    </div>
  );
}
