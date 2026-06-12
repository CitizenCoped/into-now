import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest, maskPhone } from "@/lib/auth";
import { findOrCreateConversation } from "@/lib/conversations";
import { getDb } from "@/lib/db";
import { previewMessage } from "@/lib/messagePreview";
import { PRESENCE_TTL_MS } from "@/lib/pusher";
import {
  conversationParticipants,
  conversations,
  liveSessions,
  messages,
  users,
} from "@/lib/schema";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  participantId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const myConversations = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, user.id));

  const conversationIds = myConversations.map((row) => row.conversationId);
  if (conversationIds.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const convoRows = await db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, conversationIds))
    .orderBy(desc(conversations.updatedAt));

  const participants = await db
    .select({
      conversationId: conversationParticipants.conversationId,
      userId: users.id,
      phone: users.phone,
    })
    .from(conversationParticipants)
    .innerJoin(users, eq(users.id, conversationParticipants.userId))
    .where(inArray(conversationParticipants.conversationId, conversationIds));

  const lastMessages = await db
    .select()
    .from(messages)
    .where(inArray(messages.conversationId, conversationIds))
    .orderBy(desc(messages.createdAt));

  const lastMessageByConvo = new Map<string, (typeof lastMessages)[number]>();
  for (const message of lastMessages) {
    if (!lastMessageByConvo.has(message.conversationId)) {
      lastMessageByConvo.set(message.conversationId, message);
    }
  }

  const otherUserIds = participants
    .filter((row) => row.userId !== user.id)
    .map((row) => row.userId);

  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);
  const onlineRows =
    otherUserIds.length > 0
      ? await db
          .select({ userId: liveSessions.userId })
          .from(liveSessions)
          .where(and(inArray(liveSessions.userId, otherUserIds), gt(liveSessions.lastSeenAt, cutoff)))
      : [];

  const onlineUserIds = new Set(
    onlineRows.map((row) => row.userId).filter((id): id is string => Boolean(id))
  );

  const otherByConvo = new Map<string, { id: string; phone: string }>();
  for (const row of participants) {
    if (row.userId !== user.id) {
      otherByConvo.set(row.conversationId, { id: row.userId, phone: row.phone });
    }
  }

  const result = convoRows.map((convo) => {
    const other = otherByConvo.get(convo.id);
    const lastMessage = lastMessageByConvo.get(convo.id);
    const preview = lastMessage ? previewMessage(lastMessage.body) : { preview: "", isTruncated: false };

    return {
      id: convo.id,
      updatedAt: convo.updatedAt,
      otherUser: other
        ? {
            id: other.id,
            maskedPhone: maskPhone(other.phone),
            isOnline: onlineUserIds.has(other.id),
          }
        : null,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            body: lastMessage.body,
            preview: preview.preview,
            isTruncated: preview.isTruncated,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
          }
        : null,
    };
  });

  return NextResponse.json({ conversations: result });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.participantId === user.id) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  const db = getDb();
  const [participant] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, parsed.data.participantId))
    .limit(1);

  if (!participant) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const conversationId = await findOrCreateConversation(user.id, parsed.data.participantId);

  const [otherUser] = await db
    .select({ phone: users.phone })
    .from(users)
    .where(eq(users.id, parsed.data.participantId))
    .limit(1);

  logActivity("conversation.started", {
    userId: user.id,
    phone: user.phone,
    metadata: {
      conversationId,
      participantId: parsed.data.participantId,
      participantPhone: otherUser?.phone ?? null,
    },
  });

  return NextResponse.json({ conversationId }, { status: 201 });
}