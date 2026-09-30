import type { StatusCategoryName } from "@/server/services/types";

/*
 * The design's status glyphs (docs/design/list-view-*.jpg), inlined as SVG so they pick up the
 * theme tokens via currentColor / fill utilities (dark mode keeps working).
 */

/** To do: dashed circle. */
function Todo({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="text-muted-foreground">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray="3.2 3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Active: circle with a quarter wedge. */
function Active({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="text-status-active">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M12 12V6A6 6 0 0 1 18 12z" fill="currentColor" />
    </svg>
  );
}

/** Done row icon: filled done circle with a white check. */
function DoneRow({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" className="fill-done" />
      <path
        d="m7.5 12.5 3 3 6-7"
        fill="none"
        className="stroke-white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Done pill icon: white circle with a green check (sits inside the green pill). */
function DonePill({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" className="fill-white" />
      <path
        d="m7.5 12.5 3 3 6-7"
        fill="none"
        className="stroke-done"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Status glyph for a row (18/16px) or a group pill (14px, `pill`).
 * TODO/ACTIVE colors are baked in; DONE uses two colors so it is handled per variant.
 */
export function StatusGlyph({
  category,
  size = 18,
  pill = false,
}: {
  category: StatusCategoryName;
  size?: number;
  pill?: boolean;
}) {
  if (category === "DONE") return pill ? <DonePill size={size} /> : <DoneRow size={size} />;
  if (category === "ACTIVE") return <Active size={size} strokeWidth={pill ? 2.5 : 2.2} />;
  return <Todo size={size} strokeWidth={pill ? 2.5 : 2} />;
}

/** The subtask glyph (branch with two circles) used next to subtask counts and parent lines. */
export function SubtaskGlyph({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      className={className}
    >
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 8.5V12a3 3 0 0 0 3 3h6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
