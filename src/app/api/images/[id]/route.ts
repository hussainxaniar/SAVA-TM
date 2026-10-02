import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { sessionUserFromHeaders } from "@/server/auth";

// Serves an uploaded image to members of its space. Ids are random, and the bytes never change, so
// the browser may cache them (privately) for a long time.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await sessionUserFromHeaders(request.headers);
  if (!user) return new NextResponse("Sign in to view this image.", { status: 401 });
  const { id } = await params;
  const image = await db.image.findUnique({ where: { id }, select: { spaceId: true, mimeType: true, data: true } });
  if (!image) return new NextResponse("Not found", { status: 404 });
  const member = await db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: image.spaceId, userId: user.id } }, select: { userId: true } });
  if (!member) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mimeType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
