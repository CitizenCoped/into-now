import { getDb } from "@/lib/db";
import { pushoverAlert } from "@/lib/pushover";
import { conversationParticipants, users } from "@/lib/schema";
import { and, eq, ne } from "drizzle-orm";

export function notifyAdminNewUser(phone: string) {
  pushoverAlert(
    "into.now: New user",
    `A new user signed up for the first time.\n\nPhone: ${phone}`
  );
}

export function notifyAdminReturningUser(phone: string) {
  pushoverAlert(
    "into.now: Returning user",
    `A returning user logged in.\n\nPhone: ${phone}`
  );
}

export function notifyAdminNewPost(params: {
  authorPhone: string | null;
  title: string;
  category: string;
  description: string;
}) {
  const authorLine = params.authorPhone
    ? `Author phone: ${params.authorPhone}`
    : "Author phone: (anonymous — not logged in)";

  pushoverAlert(
    "into.now: New post",
    `${authorLine}\nCategory: ${params.category}\nTitle: ${params.title}\n\n${params.description}`
  );
}

export async function notifyAdminNewMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
}) {
  const db = getDb();

  const [sender] = await db
    .select({ phone: users.phone })
    .from(users)
    .where(eq(users.id, params.senderId))
    .limit(1);

  const recipients = await db
    .select({ phone: users.phone })
    .from(conversationParticipants)
    .innerJoin(users, eq(users.id, conversationParticipants.userId))
    .where(
      and(
        eq(conversationParticipants.conversationId, params.conversationId),
        ne(conversationParticipants.userId, params.senderId)
      )
    );

  const senderPhone = sender?.phone ?? "unknown";
  const recipientPhones =
    recipients.length > 0
      ? recipients.map((row) => row.phone).join(", ")
      : "unknown";

  pushoverAlert(
    "into.now: New message",
    `Sender phone: ${senderPhone}\nRecipient phone(s): ${recipientPhones}\n\nMessage:\n${params.body}`
  );
}