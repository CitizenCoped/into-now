import { getDisplayLabel } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPushPreferences, sendPushToUser } from "@/lib/push";
import { conversationParticipants, users } from "@/lib/schema";
import { and, eq, ne } from "drizzle-orm";

export async function notifyNewMessage(params: {
  messageId: string;
  conversationId: string;
  senderId: string;
  body: string;
  /** When true the push body is masked as "Sent a photo" — notification
   *  payloads must never carry photo content or hint at it. */
  hasPhotos?: boolean;
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
    .select({
      phone: users.phone,
      email: users.email,
      displayName: users.displayName,
      isAnonymous: users.isAnonymous,
    })
    .from(users)
    .where(eq(users.id, params.senderId))
    .limit(1);

  const title = sender
    ? getDisplayLabel(sender)
    : "New message";

  await Promise.all(
    recipients.map(async (recipient) => {
      const prefs = await getPushPreferences(recipient.userId);
      if (!prefs.notifyMessages) return;

      await sendPushToUser(recipient.userId, {
        title,
        body: params.hasPhotos ? "Sent a photo" : params.body,
        url: `/?conversation=${params.conversationId}&message=${params.messageId}`,
        tag: `msg-${params.messageId}`,
      });
    })
  );
}