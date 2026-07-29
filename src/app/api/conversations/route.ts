import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest, getDisplayLabel } from "@/lib/auth";
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
import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
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
    .select({
      conversationId: conversationParticipants.conversationId,
      lastReadAt: conversationParticipants.lastReadAt,
    })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, user.id));

  const conversationIds = myConversations.map((row) => row.conversationId);
  if (conversationIds.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const lastReadByConvo = new Map(
    myConversations.map((row) => [row.conversationId, row.lastReadAt])
  );

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
      email: users.email,
      displayName: users.displayName,
      photoUrl: users.photoUrl,
      statement: users.statement,
      isAnonymous: users.isAnonymous,
      expiresAt: users.expiresAt,
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

  const unreadRows = await db
    .select({
      conversationId: messages.conversationId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(inArray(messages.conversationId, conversationIds), ne(messages.senderId, user.id)));

  const EPOCH = new Date(0);
  const unreadCountByConvo = new Map<string, number>();
  for (const row of unreadRows) {
    const lastReadAt = lastReadByConvo.get(row.conversationId) ?? EPOCH;
    if (row.createdAt > lastReadAt) {
      unreadCountByConvo.set(row.conversationId, (unreadCountByConvo.get(row.conversationId) ?? 0) + 1);
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

  const now = new Date();
  const otherByConvo = new Map<string, (typeof participants)[number]>();
  for (const row of participants) {
    if (row.userId !== user.id) {
      otherByConvo.set(row.conversationId, row);
    }
  }

  const result = convoRows.map((convo) => {
    const other = otherByConvo.get(convo.id);
    const lastMessage = lastMessageByConvo.get(convo.id);
    const preview = lastMessage ? previewMessage(lastMessage.body) : { preview: "", isTruncated: false };
    const isExpired = Boolean(other?.isAnonymous && other.expiresAt && other.expiresAt < now);

    return {
      id: convo.id,
      updatedAt: convo.updatedAt,
      unreadCount: unreadCountByConvo.get(convo.id) ?? 0,
      otherUser: other
        ? {
            id: other.userId,
            displayName: other.displayName,
            photoUrl: other.photoUrl,
            statement: other.statement,
            displayLabel: getDisplayLabel(other),
            isAnonymous: other.isAnonymous,
            isExpired,
            isOnline: !isExpired && onlineUserIds.has(other.userId),
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
    .select({
      id: users.id,
      isAnonymous: users.isAnonymous,
      expiresAt: users.expiresAt,
    })
    .from(users)
    .where(eq(users.id, parsed.data.participantId))
    .limit(1);

  if (!participant) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (participant.isAnonymous && participant.expiresAt && participant.expiresAt < new Date()) {
    return NextResponse.json({ error: "This user has expired" }, { status: 410 });
  }

  const conversationId = await findOrCreateConversation(user.id, parsed.data.participantId);

  const [otherUser] = await db
    .select({ phone: users.phone, email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, parsed.data.participantId))
    .limit(1);

  logActivity("conversation.started", {
    userId: user.id,
    phone: user.phone,
    metadata: {
      conversationId,
      participantId: parsed.data.participantId,
      participantLabel: otherUser ? getDisplayLabel(otherUser) : null,
    },
  });

  return NextResponse.json({ conversationId }, { status: 201 });
}