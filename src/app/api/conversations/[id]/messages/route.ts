import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { isBlockedBetween } from "@/lib/blocks";
import { notifyAdminNewMessage } from "@/lib/adminNotify";
import { notifyNewMessage } from "@/lib/messagePush";
import { isConversationParticipant } from "@/lib/conversations";
import { getDb } from "@/lib/db";
import { loadMessagePhotos, pusherPhotoPayload } from "@/lib/photos";
import { MAX_PHOTOS_PER_MESSAGE } from "@/lib/photoTypes";
import {
  conversationChannel,
  getPusherServer,
  MESSAGE_EVENT,
  userChannel,
} from "@/lib/pusher";
import {
  conversationParticipants,
  conversations,
  messagePhotos,
  messages,
  userPhotos,
} from "@/lib/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z
  .object({
    // A photo message may have an empty body.
    body: z.string().max(4000).default(""),
    photoIds: z.array(z.string().uuid()).max(MAX_PHOTOS_PER_MESSAGE).default([]),
  })
  .refine((data) => data.body.trim().length > 0 || data.photoIds.length > 0, {
    message: "Message needs text or at least one photo",
  });

type RouteContext = {
  params: { id: string };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isConversationParticipant(params.id, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getDb()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.id))
    .orderBy(asc(messages.createdAt));

  // Per-viewer photo serialization: presigned URLs only where this viewer
  // is the sender or holds a reveal grant, and the photo isn't hidden.
  const photosByMessage = await loadMessagePhotos(rows, user.id);
  const withPhotos = rows.map((message) => ({
    ...message,
    photos: photosByMessage.get(message.id) ?? [],
  }));

  return NextResponse.json({ messages: withPhotos });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isConversationParticipant(params.id, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();

  // Block enforcement: refuse sends when either side has blocked the other.
  const others = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, params.id));
  const otherId = others.map((p) => p.userId).find((id) => id !== user.id);
  if (otherId && (await isBlockedBetween(user.id, otherId))) {
    return NextResponse.json({ error: "You can't message this user" }, { status: 403 });
  }

  // Every attached photo must belong to the sender and be `ready`.
  const photoIds = parsed.data.photoIds;
  if (photoIds.length > 0) {
    const owned = await db
      .select({ id: userPhotos.id })
      .from(userPhotos)
      .where(
        and(
          inArray(userPhotos.id, photoIds),
          eq(userPhotos.userId, user.id),
          eq(userPhotos.status, "ready")
        )
      );
    if (owned.length !== new Set(photoIds).size) {
      return NextResponse.json(
        { error: "One or more photos aren't available to send" },
        { status: 400 }
      );
    }
  }

  const [created] = await db
    .insert(messages)
    .values({
      conversationId: params.id,
      senderId: user.id,
      body: parsed.data.body.trim(),
    })
    .returning();

  if (photoIds.length > 0) {
    await db.insert(messagePhotos).values(
      photoIds.map((photoId, index) => ({
        messageId: created.id,
        photoId,
        position: index,
      }))
    );
  }

  await db
    .update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, params.id));

  // Sender view (revealed, presigned URLs) for the POST response; the
  // Pusher payload gets the blur-only variant — the channel is shared, so
  // it must never carry object keys or URLs.
  const photosByMessage = await loadMessagePhotos([created], user.id);
  const senderPhotos = photosByMessage.get(created.id) ?? [];
  const messageForSender = { ...created, photos: senderPhotos };

  const pusher = getPusherServer();
  if (pusher) {
    const payload = {
      conversationId: params.id,
      message: { ...created, photos: pusherPhotoPayload(senderPhotos) },
    };

    await pusher.trigger(conversationChannel(params.id), MESSAGE_EVENT, payload);

    for (const participant of others) {
      await pusher.trigger(userChannel(participant.userId), MESSAGE_EVENT, payload);
    }
  }

  await notifyNewMessage({
    messageId: created.id,
    conversationId: params.id,
    senderId: user.id,
    body: created.body,
    hasPhotos: photoIds.length > 0,
  });

  void notifyAdminNewMessage({
    conversationId: params.id,
    senderId: user.id,
    body:
      photoIds.length > 0
        ? `${created.body} [+${photoIds.length} photo${photoIds.length > 1 ? "s" : ""}]`.trim()
        : created.body,
  });

  logActivity("message.sent", {
    userId: user.id,
    phone: user.phone,
    metadata: {
      conversationId: params.id,
      messageId: created.id,
      bodyPreview: created.body.slice(0, 120),
      photoCount: photoIds.length,
    },
  });

  return NextResponse.json({ message: messageForSender }, { status: 201 });
}
