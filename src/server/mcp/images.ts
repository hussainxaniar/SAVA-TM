import { db } from "../db";
import { AppError } from "../errors";

/*
 * Section 15.4 (images). Pictures live in the Image table and are referenced from task descriptions
 * and doc pages as `/api/images/<id>`. Agents get them three ways: an `images` list on get_task and
 * get_page (id, alt, absolute url), the get_image tool (the picture itself as MCP image content) and
 * the same url, which the image route also serves to a Bearer token of the image's own space.
 * Writing goes the other way: a page may only embed images already uploaded to the token's space,
 * never an arbitrary external address (a viewer's browser would fetch it).
 */

const IMAGE_PATH = /^\/api\/images\/([A-Za-z0-9_-]+)$/;

/** Largest picture get_image returns inline (base64 is a third bigger); above it only the url is given. */
export const MAX_INLINE_IMAGE_BYTES = 3_000_000;

export type ImageRef = { id: string; alt: string | null; url: string };

type Node = { type?: string; attrs?: Record<string, unknown>; content?: Node[] };

const appBase = () => (process.env.APP_URL ?? "").replace(/\/+$/, "");

export const imageUrl = (id: string) => `${appBase()}/api/images/${id}`;

/** The image nodes of any Tiptap value, in order. Sources that are not `/api/images/<id>` are returned with `id: null`. */
function walk(node: unknown, out: { id: string | null; alt: string | null; src: string }[]) {
  if (!node || typeof node !== "object") return;
  const n = node as Node;
  if (n.type === "image") {
    const src = typeof n.attrs?.src === "string" ? n.attrs.src : "";
    const alt = typeof n.attrs?.alt === "string" && n.attrs.alt.trim() ? n.attrs.alt.trim() : null;
    out.push({ id: IMAGE_PATH.exec(src)?.[1] ?? null, alt, src });
  }
  for (const child of n.content ?? []) walk(child, out);
}

/** Uploaded images referenced by a value (task description, page content), with absolute urls. */
export function imageRefs(...values: unknown[]): ImageRef[] {
  const found: { id: string | null; alt: string | null; src: string }[] = [];
  for (const v of values) walk(v, found);
  return found.filter((f): f is { id: string; alt: string | null; src: string } => f.id !== null).map((f) => ({ id: f.id, alt: f.alt, url: imageUrl(f.id) }));
}

/** Markdown out: `](/api/images/…)` becomes an absolute url so a client can follow it. */
export const absolutizeImages = (markdown: string) => markdown.replaceAll("](/api/images/", `](${appBase()}/api/images/`);

/** Markdown in: absolute urls of this app go back to the stored relative form. */
export const relativizeImages = (markdown: string) => (appBase() ? markdown.replaceAll(`](${appBase()}/api/images/`, "](/api/images/") : markdown);

/** A page may embed only images that exist in `spaceId`; anything else is refused before anything is written. */
export async function assertImagesInSpace(doc: unknown, spaceId: string): Promise<void> {
  const found: { id: string | null; alt: string | null; src: string }[] = [];
  walk(doc, found);
  if (found.length === 0) return;
  if (found.some((f) => f.id === null)) {
    throw new AppError("VALIDATION", "Only images already uploaded to this space can be used in a page (![alt](/api/images/<id>)); external image addresses are not allowed.");
  }
  const ids = [...new Set(found.map((f) => f.id as string))];
  const owned = await db.image.count({ where: { id: { in: ids }, spaceId } });
  if (owned !== ids.length) throw new AppError("NOT_FOUND", "Image not found in this space");
}
