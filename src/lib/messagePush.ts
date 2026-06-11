import { maskPhone } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPushPreferences, sendPushToUser } from "@/lib/push";
import { conversationParticipants, users } from "@/lib/schema";
import { and, eq, ne } from "drizzle-orm";

export async function notifyNewMessage(params: {
  messageId: string;
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

  await Promise.all(
    recipients.map(async (recipient) => {
      const prefs = await getPushPreferences(recipient.userId);
      if (!prefs.notifyMessages) return;

      await sendPushToUser(recipient.userId, {
        title,
        body: params.body,
        url: `/?conversation=${params.conversationId}&message=${params.messageId}`,
        tag: `msg-${params.messageId}`,
      });
    })
  );
}