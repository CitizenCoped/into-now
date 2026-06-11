import { getAuthUserFromRequest } from "@/lib/auth";
import { notifyAdminNewMessage } from "@/lib/adminNotify";
import { notifyNewMessage } from "@/lib/messagePush";
import { isConversationParticipant } from "@/lib/conversations";
import { getDb } from "@/lib/db";
import {
  conversationChannel,
  getPusherServer,
  MESSAGE_EVENT,
  userChannel,
} from "@/lib/pusher";
import { conversationParticipants, conversations, messages } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  body: z.string().min(1).max(4000),
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

  return NextResponse.json({ messages: rows });
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

  const [created] = await db
    .insert(messages)
    .values({
      conversationId: params.id,
      senderId: user.id,
      body: parsed.data.body.trim(),
    })
    .returning();

  await db
    .update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, params.id));

  const pusher = getPusherServer();
  if (pusher) {
    const payload = {
      conversationId: params.id,
      message: created,
    };

    const participants = await db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, params.id));

    await pusher.trigger(conversationChannel(params.id), MESSAGE_EVENT, payload);

    for (const participant of participants) {
      await pusher.trigger(userChannel(participant.userId), MESSAGE_EVENT, payload);
    }
  }

  await notifyNewMessage({
    messageId: created.id,
    conversationId: params.id,
    senderId: user.id,
    body: created.body,
  });

  void notifyAdminNewMessage({
    conversationId: params.id,
    senderId: user.id,
    body: created.body,
  });

  return NextResponse.json({ message: created }, { status: 201 });
}