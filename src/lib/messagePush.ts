import { maskPhone } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { previewMessage } from "@/lib/messagePreview";
import { getPushPreferences, sendPushToUser } from "@/lib/push";
import { conversationParticipants, users } from "@/lib/schema";
import { and, eq, ne } from "drizzle-orm";

export async function notifyNewMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
}) {
  const db = getDb();

  const recipients = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, params.conversationId),
        ne(conversationParticipants.userId, params.senderId)
      )
    );

  const [sender] = await db
    .select({ phone: users.phone })
    .from(users)
    .where(eq(users.id, params.senderId))
    .limit(1);

  const title = sender ? maskPhone(sender.phone) : "New message";
  const { preview } = previewMessage(params.body);

  for (const recipient of recipients) {
    const prefs = await getPushPreferences(recipient.userId);
    if (!prefs.notifyMessages) continue;

    await sendPushToUser(recipient.userId, {
      title,
      body: preview || "Sent you a message",
      url: `/?conversation=${params.conversationId}`,
      tag: `msg-${params.conversationId}`,
    });
  }
}