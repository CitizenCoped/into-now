import { logActivity } from "@/lib/activity";
import { notifyAdminPhotoRejection } from "@/lib/adminNotify";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { scanImageUrl } from "@/lib/moderation";
import { REJECT_HOLD_MS } from "@/lib/moderationCatalog";
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

  let result;
  try {
    const scanUrl = isSpacesConfigured() ? await presignView(photo.objectKey) : null;
    result = scanUrl
      ? await scanImageUrl(scanUrl)
      : {
          ok: true,
          skipped: true,
          topScore: 0,
          topClass: null,
          scores: {},
          triggered: [],
          raw: null,
        };
  } catch (error) {
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
      topClass: result.topClass,
      topScore: result.topScore,
      scores: result.scores,
      triggered: result.triggered,
    },
  });

  void notifyAdminPhotoRejection({
    photoId: params.id,
    userId: user.id,
    topClass: result.topClass,
    topScore: result.topScore,
  });

  return NextResponse.json({ status: "rejected" });
}
