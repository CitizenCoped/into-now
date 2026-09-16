import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FEATURES } from "@/lib/flags";
import { MAX_PHOTO_BYTES } from "@/lib/photoTypes";
import { userPhotos } from "@/lib/schema";
import {
  ALLOWED_PHOTO_CONTENT_TYPES,
  isSpacesConfigured,
  putObject,
} from "@/lib/spaces";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: { id: string };
};

/** PUT /api/photos/[id]/content — same-origin upload of the normalized
 *  JPEG. Avoids a browser PUT to Spaces (which needs CORS on the bucket). */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  if (!FEATURES.photoBlur) {
    return NextResponse.json({ error: "Photos are not enabled" }, { status: 403 });
  }

  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSpacesConfigured()) {
    return NextResponse.json(
      { error: "Photo storage is not configured" },
      { status: 503 }
    );
  }

  const contentType = (request.headers.get("content-type") ?? "image/jpeg")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_PHOTO_CONTENT_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const db = getDb();
  const [photo] = await db
    .select({
      id: userPhotos.id,
      objectKey: userPhotos.objectKey,
      status: userPhotos.status,
    })
    .from(userPhotos)
    .where(and(eq(userPhotos.id, params.id), eq(userPhotos.userId, user.id)))
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (photo.status !== "scanning" || !photo.objectKey) {
    return NextResponse.json({ error: "Photo is not awaiting upload" }, { status: 409 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "Empty upload" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Photo is too large" }, { status: 413 });
  }

  try {
    await putObject(photo.objectKey, bytes, contentType);
  } catch (error) {
    console.error("photo object put failed:", error);
    return NextResponse.json({ error: "Upload failed, try again" }, { status: 502 });
  }

  logActivity("photo.uploaded", {
    userId: user.id,
    phone: user.phone,
    metadata: { photoId: photo.id, bytes: bytes.byteLength },
  });

  return NextResponse.json({ ok: true });
}
