import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { PhotoUpdatedPayload } from "@/lib/photoTypes";
import { conversationChannel, getPusherServer, PHOTO_UPDATED_EVENT } from "@/lib/pusher";
import { messagePhotos, messages } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: { id: string; photoId: string };
};

/** POST /api/messages/[id]/photos/[photoId]/hide — sender only. Toggles
 *  the closed-eye state. While hidden the server stops issuing presigned
 *  URLs for this photo (see loadMessagePhotos); reversible anytime. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [message] = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
    })
    .from(messages)
    .where(eq(messages.id, params.id))
    .limit(1);

  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (message.senderId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [attachment] = await db
    .select({ hiddenBySender: messagePhotos.hiddenBySender })
    .from(messagePhotos)
    .where(
      and(
        eq(messagePhotos.messageId, params.id),
        eq(messagePhotos.photoId, params.photoId)
      )
    )
    .limit(1);

  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hiddenBySender = !attachment.hiddenBySender;

  await db
    .update(messagePhotos)
    .set({ hiddenBySender })
    .where(
      and(
        eq(messagePhotos.messageId, params.id),
        eq(messagePhotos.photoId, params.photoId)
      )
    );

  const pusher = getPusherServer();
  if (pusher) {
    const payload: PhotoUpdatedPayload = {
      conversationId: message.conversationId,
      messageId: params.id,
      photoId: params.photoId,
      hiddenBySender,
    };
    await pusher.trigger(
      conversationChannel(message.conversationId),
      PHOTO_UPDATED_EVENT,
      payload
    );
  }

  logActivity(hiddenBySender ? "photo.hidden" : "photo.unhidden", {
    userId: user.id,
    phone: user.phone,
    metadata: { messageId: params.id, photoId: params.photoId },
  });

  return NextResponse.json({ hiddenBySender });
}
