import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { isConversationParticipant } from "@/lib/conversations";
import { getDb } from "@/lib/db";
import { getRevealModel } from "@/lib/photos";
import { messagePhotos, messages, photoReveals } from "@/lib/schema";
import { isSpacesConfigured, presignView } from "@/lib/spaces";
import { userPhotos } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: { id: string; photoId: string };
};

/** POST /api/messages/[id]/photos/[photoId]/reveal — tap-to-reveal
 *  (decided): the viewer self-grants. Grants persist (decided) — once
 *  revealed, the viewer keeps access; no view-once expiry in v3. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [message] = await db
    .select({ id: messages.id, conversationId: messages.conversationId, senderId: messages.senderId })
    .from(messages)
    .where(eq(messages.id, params.id))
    .limit(1);

  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await isConversationParticipant(message.conversationId, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [attachment] = await db
    .select({
      photoId: messagePhotos.photoId,
      hiddenBySender: messagePhotos.hiddenBySender,
      objectKey: userPhotos.objectKey,
    })
    .from(messagePhotos)
    .innerJoin(userPhotos, eq(userPhotos.id, messagePhotos.photoId))
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

  // Server-authoritative hidden state: no reveals while hidden.
  if (attachment.hiddenBySender && message.senderId !== user.id) {
    return NextResponse.json({ error: "Photo is hidden by sender" }, { status: 409 });
  }

  const now = new Date();

  // Self-grant (tap model, the shipped default). The `grant` model would
  // set requestedAt only and wait for the sender — reserved for later.
  if (message.senderId !== user.id && getRevealModel() !== "immediate") {
    await db
      .insert(photoReveals)
      .values({
        messageId: params.id,
        photoId: params.photoId,
        viewerId: user.id,
        requestedAt: now,
        grantedAt: now,
      })
      .onConflictDoUpdate({
        target: [photoReveals.messageId, photoReveals.photoId, photoReveals.viewerId],
        set: { grantedAt: now },
      });

    logActivity("photo.revealed", {
      userId: user.id,
      phone: user.phone,
      metadata: { messageId: params.id, photoId: params.photoId },
    });
  }

  const url =
    !attachment.hiddenBySender && isSpacesConfigured()
      ? await presignView(attachment.objectKey)
      : null;

  return NextResponse.json({ revealed: true, url });
}
