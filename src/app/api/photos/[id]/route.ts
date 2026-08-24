import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { userPhotos } from "@/lib/schema";
import { deleteObject, isSpacesConfigured } from "@/lib/spaces";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: { id: string };
};

/** DELETE /api/photos/[id] — remove a photo from the caller's library and
 *  from Spaces. Cascades remove message/post attachments and reveal
 *  grants, so previously-sent copies go dark everywhere. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [photo] = await db
    .select({ id: userPhotos.id, objectKey: userPhotos.objectKey })
    .from(userPhotos)
    .where(and(eq(userPhotos.id, params.id), eq(userPhotos.userId, user.id)))
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(userPhotos).where(eq(userPhotos.id, params.id));

  if (photo.objectKey && isSpacesConfigured()) {
    try {
      await deleteObject(photo.objectKey);
    } catch (error) {
      console.error("failed to delete photo object:", error);
    }
  }

  logActivity("photo.deleted", {
    userId: user.id,
    phone: user.phone,
    metadata: { photoId: params.id },
  });

  return NextResponse.json({ ok: true });
}
