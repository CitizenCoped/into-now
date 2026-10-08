import { logActivity } from "@/lib/activity";
import { notifyAdminPhotoRejection } from "@/lib/adminNotify";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ModerationUnavailableError, scanImageUrl, scanVideoUrl } from "@/lib/moderation";
import { REJECT_HOLD_MS, surfaceForPurpose } from "@/lib/moderationCatalog";
import { userPhotos } from "@/lib/schema";
import { isSpacesConfigured, presignView } from "@/lib/spaces";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: { id: string };
};

/** POST /api/photos/[id]/scan — called by the client after the direct
 *  upload completes. Runs sync moderation and flips the photo to `ready`
 *  or `rejected`. Rejected objects are kept for 7 days so a human can
 *  allow or uphold the decision. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [photo] = await db
    .select()
    .from(userPhotos)
    .where(and(eq(userPhotos.id, params.id), eq(userPhotos.userId, user.id)))
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (photo.status !== "scanning") {
    return NextResponse.json({ status: photo.status });
  }

  // DM library photos and post media are judged by different profiles.
  const surface = surfaceForPurpose(photo.purpose);

  let result;
  try {
    const scanUrl = isSpacesConfigured() ? await presignView(photo.objectKey) : null;
    result = scanUrl
      ? photo.kind === "video"
        ? await scanVideoUrl(scanUrl, { surface })
        : await scanImageUrl(scanUrl, { surface })
      : {
          ok: true,
          skipped: true,
          surface,
          topScore: 0,
          topClass: null,
          scores: {},
          triggered: [],
          raw: null,
        };
  } catch (error) {
    // Fail closed: media that can't be screened never becomes `ready`.
    // The client DELETEs the row on a non-OK scan, so nothing lingers.
    if (error instanceof ModerationUnavailableError) {
      console.warn(`photo scan unavailable (${photo.kind}):`, error.message);
      return NextResponse.json(
        {
          error:
            photo.kind === "video"
              ? "Video screening isn't available yet — photos only for now."
              : "Photo screening isn't available right now.",
        },
        { status: 503 }
      );
    }
    console.error("photo scan failed:", error);
    return NextResponse.json({ error: "Scan failed, try again" }, { status: 502 });
  }

  if (result.ok) {
    await db
      .update(userPhotos)
      .set({
        status: "ready",
        moderationScores: result.scores,
        moderationRaw: result.raw,
        reviewStatus: null,
        objectPurgeAt: null,
      })
      .where(eq(userPhotos.id, params.id));

    logActivity("photo.approved", {
      userId: user.id,
      phone: user.phone,
      metadata: {
        photoId: params.id,
        kind: photo.kind,
        purpose: photo.purpose,
        surface,
        moderationSkipped: result.skipped,
        topClass: result.topClass,
        topScore: result.topScore,
        scores: result.scores,
      },
    });

    return NextResponse.json({ status: "ready" });
  }

  const objectPurgeAt = new Date(Date.now() + REJECT_HOLD_MS);

  await db
    .update(userPhotos)
    .set({
      status: "rejected",
      moderationScores: result.scores,
      moderationRaw: result.raw,
      reviewStatus: "pending",
      objectPurgeAt,
    })
    .where(eq(userPhotos.id, params.id));

  logActivity("photo.rejected", {
    userId: user.id,
    phone: user.phone,
    metadata: {
      photoId: params.id,
      kind: photo.kind,
      purpose: photo.purpose,
      surface,
      topClass: result.topClass,
      topScore: result.topScore,
      scores: result.scores,
      triggered: result.triggered,
    },
  });

  void notifyAdminPhotoRejection({
    photoId: params.id,
    userId: user.id,
    kind: photo.kind,
    surface,
    topClass: result.topClass,
    topScore: result.topScore,
  });

  return NextResponse.json({ status: "rejected" });
}
