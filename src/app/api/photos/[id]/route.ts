import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { messagePhotos, postPhotos, userPhotos } from "@/lib/schema";
import { deleteObject, isSpacesConfigured } from "@/lib/spaces";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: { id: string };
};

/** Client-reported reasons for deleting a row that never became `ready`.
 *  Anything else (or absent) is a normal user-initiated removal. */
const FAILURE_REASONS = new Set(["upload_failed", "scan_failed"]);

/** DELETE /api/photos/[id] — remove a photo from the caller's library.
 *
 *  If the photo was already sent (message or post attachment), it is
 *  `archived`: it no longer occupies a gallery slot, but the object stays
 *  so existing chats keep working. Never-sent photos are deleted from the
 *  DB and from Spaces.
 *
 *  `?reason=upload_failed|scan_failed&status=NNN` marks a cleanup after a
 *  failed upload or scan; those rows are always hard-deleted. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reason = request.nextUrl.searchParams.get("reason");
  const failure = reason !== null && FAILURE_REASONS.has(reason);
  const status = Number(request.nextUrl.searchParams.get("status"));

  const db = getDb();
  const [photo] = await db
    .select({ id: userPhotos.id, objectKey: userPhotos.objectKey, status: userPhotos.status })
    .from(userPhotos)
    .where(and(eq(userPhotos.id, params.id), eq(userPhotos.userId, user.id)))
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!failure) {
    const [inMessage] = await db
      .select({ messageId: messagePhotos.messageId })
      .from(messagePhotos)
      .where(eq(messagePhotos.photoId, photo.id))
      .limit(1);
    const [inPost] = await db
      .select({ postId: postPhotos.postId })
      .from(postPhotos)
      .where(eq(postPhotos.photoId, photo.id))
      .limit(1);

    if (inMessage || inPost) {
      await db
        .update(userPhotos)
        .set({ status: "archived" })
        .where(eq(userPhotos.id, photo.id));

      logActivity("photo.archived", {
        userId: user.id,
        phone: user.phone,
        metadata: { photoId: params.id },
      });

      return NextResponse.json({ ok: true, archived: true });
    }
  }

  await db.delete(userPhotos).where(eq(userPhotos.id, params.id));

  if (photo.objectKey && isSpacesConfigured()) {
    try {
      await deleteObject(photo.objectKey);
    } catch (error) {
      console.error("failed to delete photo object:", error);
    }
  }

  if (failure) {
    logActivity("photo.upload_failed", {
      userId: user.id,
      phone: user.phone,
      metadata: {
        photoId: params.id,
        reason,
        status: Number.isFinite(status) && status > 0 ? status : null,
      },
    });
  } else {
    logActivity("photo.deleted", {
      userId: user.id,
      phone: user.phone,
      metadata: { photoId: params.id },
    });
  }

  return NextResponse.json({ ok: true, archived: false });
}
