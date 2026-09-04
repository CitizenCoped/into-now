import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { scanImageUrl } from "@/lib/moderation";
import { userPhotos } from "@/lib/schema";
import { deleteObject, isSpacesConfigured, presignView } from "@/lib/spaces";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: { id: string };
};

/** POST /api/photos/[id]/scan — called by the client after the direct
 *  upload completes. Runs sync moderation and flips the photo to `ready`
 *  or `rejected`. Rejected objects are deleted from Spaces immediately —
 *  no image is ever kept for a rejected photo. */
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
    // The scan URL is a short-lived presigned GET minted just for the
    // moderation vendor; the object itself stays private.
    const scanUrl = isSpacesConfigured() ? await presignView(photo.objectKey) : null;
    result = scanUrl
      ? await scanImageUrl(scanUrl)
      : { ok: true, skipped: true, topScore: 0, topClass: null, scores: {} };
  } catch (error) {
    // Leave the photo in `scanning` — never silently approve on vendor
    // failure. The client can retry.
    console.error("photo scan failed:", error);
    return NextResponse.json({ error: "Scan failed, try again" }, { status: 502 });
  }

  if (result.ok) {
    await db
      .update(userPhotos)
      .set({ status: "ready" })
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

  // Rejected: mark the row (kept for audit) and delete the object now.
  await db
    .update(userPhotos)
    .set({ status: "rejected" })
    .where(eq(userPhotos.id, params.id));

  try {
    await deleteObject(photo.objectKey);
  } catch (error) {
    console.error("failed to delete rejected photo object:", error);
  }

  logActivity("photo.rejected", {
    userId: user.id,
    phone: user.phone,
    metadata: {
      photoId: params.id,
      topClass: result.topClass,
      topScore: result.topScore,
      scores: result.scores,
    },
  });

  return NextResponse.json({ status: "rejected" });
}
