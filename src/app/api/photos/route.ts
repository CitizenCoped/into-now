import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FEATURES } from "@/lib/flags";
import {
  LIBRARY_SLOT_STATUSES,
  MAX_LIBRARY_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_POST_VIDEO_SECONDS,
  MAX_VIDEO_BYTES,
} from "@/lib/photoTypes";
import { userPhotos } from "@/lib/schema";
import {
  ALLOWED_PHOTO_CONTENT_TYPES,
  ALLOWED_VIDEO_CONTENT_TYPES,
  deleteObject,
  isSpacesConfigured,
  photoObjectKey,
  presignUpload,
} from "@/lib/spaces";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z
  .object({
    contentType: z.string(),
    sizeBytes: z.number().int().positive().max(MAX_VIDEO_BYTES),
    isLive: z.boolean().default(false),
    /** ~300B placeholder generated client-side by src/lib/blur.ts (for a
     *  video, from its poster frame). */
    blurDataUrl: z.string().startsWith("data:image/").max(4096),
    aspectRatio: z.number().positive().max(10).default(1),
    kind: z.enum(["photo", "video"]).default("photo"),
    purpose: z.enum(["library", "post"]).default("library"),
    /** Client-measured; the server can't cheaply probe the container, so
     *  this is the bound we enforce. Required for videos. */
    durationMs: z
      .number()
      .int()
      .positive()
      .max(MAX_POST_VIDEO_SECONDS * 1000)
      .optional(),
  })
  .refine((d) => d.kind !== "video" || (d.purpose === "post" && d.durationMs !== undefined), {
    message: "Videos are post media only and need a duration",
  })
  .refine((d) => d.kind === "video" || d.sizeBytes <= MAX_PHOTO_BYTES, {
    message: "Photo is too large",
  });

/** A `scanning` row older than this is an upload that never finished (the
 *  presigned PUT expires after 5 min). It can't be resumed, so it's swept. */
const STALE_SCANNING_MS = 15 * 60 * 1000;

/** GET /api/photos — the caller's DM library. Blur placeholders only; no
 *  object keys, no URLs. Only `ready` rows: a `scanning` row is either an
 *  in-flight upload this client already knows about locally, or an orphan
 *  from a failed one — never something another session can resume. Post
 *  media (`purpose = post`) is not part of the library. */
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
    .where(
      and(
        eq(userPhotos.userId, user.id),
        eq(userPhotos.status, "ready"),
        eq(userPhotos.purpose, "library")
      )
    )
    .orderBy(desc(userPhotos.createdAt));

  return NextResponse.json({ photos: rows });
}

/** POST /api/photos — create a `scanning` row for a photo or a post video.
 *  The client then PUTs bytes to `/api/photos/[id]/content` (same-origin).
 *  `uploadUrl` is still returned for older clients; new clients ignore it. */
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

  const { kind, purpose, contentType } = parsed.data;
  const allowedTypes =
    kind === "video" ? ALLOWED_VIDEO_CONTENT_TYPES : ALLOWED_PHOTO_CONTENT_TYPES;
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json(
      { error: kind === "video" ? "Unsupported video type" : "Unsupported image type" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Sweep this user's abandoned uploads so they don't count toward the cap.
  const stale = await db
    .delete(userPhotos)
    .where(
      and(
        eq(userPhotos.userId, user.id),
        eq(userPhotos.status, "scanning"),
        lt(userPhotos.createdAt, new Date(Date.now() - STALE_SCANNING_MS))
      )
    )
    .returning({ id: userPhotos.id, objectKey: userPhotos.objectKey });
  if (stale.length > 0) {
    await Promise.allSettled(
      stale.filter((row) => row.objectKey).map((row) => deleteObject(row.objectKey))
    );
    logActivity("photo.upload_abandoned", {
      userId: user.id,
      phone: user.phone,
      metadata: { photoIds: stale.map((row) => row.id) },
    });
  }

  // The 10-slot cap is a library concept; post media is bounded per post
  // (MAX_POST_MEDIA) in POST /api/posts instead.
  if (purpose === "library") {
    const existing = await db
      .select({ id: userPhotos.id })
      .from(userPhotos)
      .where(
        and(
          eq(userPhotos.userId, user.id),
          eq(userPhotos.purpose, "library"),
          inArray(userPhotos.status, [...LIBRARY_SLOT_STATUSES])
        )
      );
    if (existing.length >= MAX_LIBRARY_PHOTOS) {
      return NextResponse.json(
        { error: `Library is full (${MAX_LIBRARY_PHOTOS} photos max)` },
        { status: 400 }
      );
    }
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
      kind,
      purpose,
      durationMs: kind === "video" ? (parsed.data.durationMs ?? null) : null,
      status: "scanning",
    })
    .returning({ id: userPhotos.id });

  const objectKey = photoObjectKey(user.id, created.id, contentType);
  await db
    .update(userPhotos)
    .set({ objectKey })
    .where(eq(userPhotos.id, created.id));

  const uploadUrl = await presignUpload(objectKey, contentType, parsed.data.sizeBytes);

  logActivity("photo.upload_started", {
    userId: user.id,
    phone: user.phone,
    metadata: { photoId: created.id, isLive: parsed.data.isLive, kind, purpose },
  });

  return NextResponse.json({ photoId: created.id, uploadUrl }, { status: 201 });
}
