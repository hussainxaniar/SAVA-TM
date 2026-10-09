import { describe, expect, it, vi } from "vitest";
import { rowKeyboardOnly } from "@/lib/dnd";

describe("rowKeyboardOnly", () => {
  it("runs the keyboard handler only when the row itself is the target", () => {
    const onKeyDown = vi.fn();
    const onPointerDown = vi.fn();
    const wrapped = rowKeyboardOnly({ onKeyDown, onPointerDown } as never) as unknown as Record<string, (e: unknown) => void>;

    const row = {};
    wrapped.onKeyDown({ target: row, currentTarget: row });
    expect(onKeyDown).toHaveBeenCalledTimes(1);

    wrapped.onKeyDown({ target: {}, currentTarget: row }); // a space typed in an input inside the row
    expect(onKeyDown).toHaveBeenCalledTimes(1);

    expect(wrapped.onPointerDown).toBe(onPointerDown); // pointer dragging is untouched
  });

  it("passes through listeners without a keyboard handler, and undefined", () => {
    const pointerOnly = { onPointerDown: vi.fn() };
    expect(rowKeyboardOnly(pointerOnly as never)).toBe(pointerOnly);
    expect(rowKeyboardOnly(undefined)).toBeUndefined();
  });
});
