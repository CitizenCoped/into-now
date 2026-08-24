import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FEATURES } from "@/lib/flags";
import { MAX_LIBRARY_PHOTOS, MAX_PHOTO_BYTES } from "@/lib/photoTypes";
import { userPhotos } from "@/lib/schema";
import {
  ALLOWED_PHOTO_CONTENT_TYPES,
  isSpacesConfigured,
  photoObjectKey,
  presignUpload,
} from "@/lib/spaces";
import { and, desc, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  contentType: z.string(),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
  isLive: z.boolean().default(false),
  /** ~300B placeholder generated client-side by src/lib/blur.ts. */
  blurDataUrl: z.string().startsWith("data:image/").max(4096),
  aspectRatio: z.number().positive().max(10).default(1),
});

/** GET /api/photos — the caller's library. Blur placeholders only; no
 *  object keys, no URLs. */
export async function GET(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getDb()
    .select({
      id: userPhotos.id,
      blurDataUrl: userPhotos.blurDataUrl,
      aspectRatio: userPhotos.aspectRatio,
      isLive: userPhotos.isLive,
      status: userPhotos.status,
    })
    .from(userPhotos)
    .where(and(eq(userPhotos.userId, user.id), ne(userPhotos.status, "rejected")))
    .orderBy(desc(userPhotos.createdAt));

  return NextResponse.json({ photos: rows });
}

/** POST /api/photos — create a `scanning` library row and return a
 *  presigned PUT for direct-to-Spaces upload. */
export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!ALLOWED_PHOTO_CONTENT_TYPES.includes(parsed.data.contentType)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const db = getDb();

  const existing = await db
    .select({ id: userPhotos.id })
    .from(userPhotos)
    .where(and(eq(userPhotos.userId, user.id), ne(userPhotos.status, "rejected")));
  if (existing.length >= MAX_LIBRARY_PHOTOS) {
    return NextResponse.json(
      { error: `Library is full (${MAX_LIBRARY_PHOTOS} photos max)` },
      { status: 400 }
    );
  }

  // Two-step insert: we need the photo id inside the object key.
  const [created] = await db
    .insert(userPhotos)
    .values({
      userId: user.id,
      objectKey: "",
      blurDataUrl: parsed.data.blurDataUrl,
      aspectRatio: parsed.data.aspectRatio,
      isLive: parsed.data.isLive,
      status: "scanning",
    })
    .returning({ id: userPhotos.id });

  const objectKey = photoObjectKey(user.id, created.id, parsed.data.contentType);
  await db
    .update(userPhotos)
    .set({ objectKey })
    .where(eq(userPhotos.id, created.id));

  const uploadUrl = await presignUpload(
    objectKey,
    parsed.data.contentType,
    parsed.data.sizeBytes
  );

  logActivity("photo.upload_started", {
    userId: user.id,
    phone: user.phone,
    metadata: { photoId: created.id, isLive: parsed.data.isLive },
  });

  return NextResponse.json({ photoId: created.id, uploadUrl }, { status: 201 });
}
