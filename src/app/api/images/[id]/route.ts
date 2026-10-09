import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { sessionUserFromHeaders } from "@/server/auth";
import { resolveApiToken } from "@/server/services/api-tokens";

// Serves an uploaded image to members of its space: a signed-in session, or (for AI clients, Section 15)
// an API token of the image's own space. Ids are random, and the bytes never change, so the browser may
// cache them (privately) for a long time.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  const token = secret ? await resolveApiToken(secret) : null;
  const user = token ? null : await sessionUserFromHeaders(request.headers);
  if (!token && !user) return new NextResponse("Sign in to view this image.", { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="sava-tm"' } });
  const { id } = await params;
  const image = await db.image.findUnique({ where: { id }, select: { spaceId: true, mimeType: true, data: true } });
  if (!image) return new NextResponse("Not found", { status: 404 });
  if (token) {
    // resolveApiToken already re-checked that the token's user still belongs to the token's space.
    if (token.spaceId !== image.spaceId) return new NextResponse("Not found", { status: 404 });
  } else {
    const member = await db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: image.spaceId, userId: user!.id } }, select: { userId: true } });
    if (!member) return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mimeType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
