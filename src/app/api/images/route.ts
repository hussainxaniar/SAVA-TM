import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { sessionUserFromHeaders } from "@/server/auth";
import { requireMember } from "@/server/guards";

// Images pasted or dropped into task descriptions and docs (Section 9.4 / 11). They live in Postgres
// (the Image table) so the app needs no storage service; the editors insert the returned URL.
// Members of the space only; PNG, JPEG, WebP or GIF up to 4 MB (Vercel's request limit is 4.5 MB).
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  const user = await sessionUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in to upload images." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const spaceId = form?.get("spaceId");
  if (!(file instanceof File) || typeof spaceId !== "string") {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  try {
    await requireMember(user.id, spaceId);
  } catch {
    return NextResponse.json({ error: "You can't upload to this space." }, { status: 403 });
  }
  if (!TYPES.has(file.type)) return NextResponse.json({ error: "Use a PNG, JPEG, WebP or GIF image." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Images can be at most 4 MB." }, { status: 413 });

  const image = await db.image.create({
    data: { spaceId, uploadedById: user.id, mimeType: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) },
    select: { id: true },
  });
  return NextResponse.json({ id: image.id, url: `/api/images/${image.id}` });
}
