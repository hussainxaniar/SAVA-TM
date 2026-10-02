"use client";

import { useRef, useState } from "react";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";

/*
 * ResizableImage (I-01): the Tiptap image node with a persisted `width` attribute and a
 * React node view that shows a drag handle on the bottom-right corner while the image is
 * selected or hovered. Only the width is stored (the aspect ratio follows via height:auto),
 * clamped to 80–1200px and never wider than the editor. Double-clicking the handle resets
 * to the natural size (width: null).
 */

function ImageView(props: NodeViewProps) {
  const { editor, node, selected, updateAttributes } = props;
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ startX: number; startWidth: number; maxWidth: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [resizing, setResizing] = useState(false);
  const showHandle = selected || hovered || resizing;
  const width = typeof node.attrs.width === "number" ? node.attrs.width : null;

  const onPointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    const image = imageRef.current;
    if (!image || drag.current) return;
    // preventDefault suppresses the compatibility mouse events, so ProseMirror doesn't
    // treat the drag as a click and the editor keeps its selection.
    event.preventDefault();
    event.stopPropagation();
    drag.current = {
      startX: event.clientX,
      startWidth: image.getBoundingClientRect().width,
      maxWidth: Math.min(1200, Math.max(80, editor.view.dom.clientWidth)),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return;
    const offset = event.clientX - drag.current.startX;
    if (offset === 0) return;
    const next = drag.current.startWidth + offset;
    updateAttributes({
      width: Math.round(Math.min(drag.current.maxWidth, Math.max(80, next))),
    });
  };

  // Pointer capture is released implicitly on pointerup/pointercancel.
  const onPointerEnd = () => {
    if (!drag.current) return;
    drag.current = null;
    setResizing(false);
  };

  return (
    <NodeViewWrapper
      className="relative inline-block max-w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        ref={imageRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ""}
        draggable={false}
        className={cn("block max-w-full", showHandle ? "ring-2 ring-primary" : "")}
        style={{ width: width ?? undefined, maxWidth: "100%" }}
      />
      {showHandle && (
        <span
          aria-hidden="true"
          className="absolute -bottom-1 -right-1 size-2.5 cursor-ew-resize rounded-[2px] bg-primary"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onDoubleClick={() => updateAttributes({ width: null })}
        />
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = Number(element.getAttribute("width"));
          return Number.isFinite(value) && value > 0 ? value : null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.width === "number" ? { width: attributes.width } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

export const imageExtensions = [ResizableImage.configure({ inline: false, allowBase64: false })];
