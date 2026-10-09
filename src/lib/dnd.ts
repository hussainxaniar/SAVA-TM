/**
 * Rows that drag from anywhere spread dnd-kit's `listeners` on the whole row. The keyboard sensor
 * starts a drag on Space or Enter and cancels the key, and key events bubble up from everything
 * inside the row: typing a space in a rename input started a keyboard drag (the row went gray and
 * the space was swallowed). Wrap the listeners so the keyboard handler only runs when the row
 * itself has focus, never for events coming from an input, button or menu inside it.
 */
type KeyEventLike = { target: unknown; currentTarget: unknown };

export function rowKeyboardOnly<T extends object | undefined>(listeners: T): T {
  const original = (listeners as Record<string, unknown> | undefined)?.onKeyDown as ((event: KeyEventLike) => void) | undefined;
  if (!listeners || !original) return listeners;
  return {
    ...listeners,
    onKeyDown: (event: KeyEventLike) => {
      if (event.target !== event.currentTarget) return;
      original(event);
    },
  } as T;
}
