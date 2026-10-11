"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { IconCheck } from "@tabler/icons-react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { cn } from "@/lib/utils";

/*
 * The phone's bottom sheet (docs/design/mobile.md, "Bottom sheet"): a modal panel that slides up
 * over a scrim. Top radius 16, a 36x4 grabber in a 20px area, a 44px header (title left, one
 * optional action right), content, then the bottom safe area. Built on the Base UI dialog, so
 * focus is trapped, Esc and a tap on the scrim close it, and it is announced as a dialog.
 * Pickers on a phone use this instead of a dropdown or popover.
 */

export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown in the header; also the dialog's accessible name. Omit only with `label`. */
  title?: React.ReactNode;
  /** Accessible name when there is no visible title. */
  label?: string;
  /** Right side of the header, usually a <BottomSheetAction>. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function BottomSheet({ open, onOpenChange, title, label, action, children, className }: BottomSheetProps) {
  // A sheet with a field (search, rename) rides above the on-screen keyboard.
  const keyboard = useKeyboardInset();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* forceRender: a sheet opened from the full-screen task dialog is a nested dialog, and Base UI
            drops a nested dialog's backdrop unless told to keep it. */}
        <DialogPrimitive.Backdrop
          forceRender
          className="fixed inset-0 z-50 bg-scrim duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          data-slot="bottom-sheet"
          aria-label={title ? undefined : label}
          style={keyboard ? { bottom: keyboard } : undefined}
          // React bubbles events through portals: a tap inside the sheet must not reach the row
          // (open task, start a drag) the sheet was opened from. Handbook bug class 1.
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl bg-popover text-popover-foreground outline-none duration-200",
            "pb-[env(safe-area-inset-bottom)] data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
            className,
          )}
        >
          <div aria-hidden className="flex h-5 shrink-0 items-center justify-center">
            <span className="h-1 w-9 rounded-full bg-input" />
          </div>
          {(title || action) && (
            <div className="flex h-11 shrink-0 items-center pl-4 pr-2">
              <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-[17px] font-semibold leading-6 text-foreground">
                {title}
              </DialogPrimitive.Title>
              {action}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The header's text action ("Done"): 44px high, primary colour. */
export function BottomSheetAction({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn("flex h-11 shrink-0 items-center px-2 text-base font-semibold text-primary", className)}
      {...props}
    />
  );
}

/**
 * One 52px option row: a 24px icon slot, the label, and a check when selected (the selected row
 * is tinted). `destructive` paints it in the overdue colour.
 */
export function BottomSheetOption({
  icon,
  selected = false,
  destructive = false,
  trailing,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  icon?: React.ReactNode;
  selected?: boolean;
  destructive?: boolean;
  /** Right-aligned extra (a value, a count) shown instead of the check when not selected. */
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected || undefined}
      className={cn(
        "flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-base",
        selected ? "bg-selected font-medium text-selected-foreground" : destructive ? "text-overdue" : "text-foreground",
        className,
      )}
      {...props}
    >
      {icon !== undefined && <span className="flex w-6 shrink-0 justify-center">{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
      {selected ? <IconCheck aria-hidden className="size-5 shrink-0" strokeWidth={2.2} /> : trailing}
    </button>
  );
}
