import { getDisplayLabel } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { pushoverAlert } from "@/lib/pushover";
import { conversationParticipants, users } from "@/lib/schema";
import { and, eq, ne } from "drizzle-orm";

export function formatFullPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return phone;
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function formatUserContact(user: {
  phone: string | null;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
}): string {
  if (user.phone) return formatFullPhone(user.phone);
  if (user.email) return user.email;
  return getDisplayLabel(user);
}

async function lookupUser(userId: string) {
  const [row] = await getDb()
    .select({
      phone: users.phone,
      email: users.email,
      displayName: users.displayName,
      isAnonymous: users.isAnonymous,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
}

export function notifyAdminNewUser(contact: string) {
  pushoverAlert(
    "into.now: New user",
    `A new user signed up for the first time.\n\nContact: ${contact}`
  );
}

export function notifyAdminReturningUser(contact: string) {
  pushoverAlert(
    "into.now: Returning user",
    `A returning user logged in.\n\nContact: ${contact}`
  );
}

export async function notifyAdminNewPost(params: {
  authorId: string | null;
  title: string;
  category: string;
  description: string;
}) {
  const author = params.authorId ? await lookupUser(params.authorId) : null;
  const authorLine = author
    ? `Author: ${formatUserContact(author)}`
    : "Author: (not logged in)";

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
    .select({
      phone: users.phone,
      email: users.email,
      displayName: users.displayName,
      isAnonymous: users.isAnonymous,
    })
    .from(users)
    .where(eq(users.id, params.senderId))
    .limit(1);

  const recipients = await db
    .select({
      phone: users.phone,
      email: users.email,
      displayName: users.displayName,
      isAnonymous: users.isAnonymous,
    })
    .from(conversationParticipants)
    .innerJoin(users, eq(users.id, conversationParticipants.userId))
    .where(
      and(
        eq(conversationParticipants.conversationId, params.conversationId),
        ne(conversationParticipants.userId, params.senderId)
      )
    );

  const senderLabel = sender ? formatUserContact(sender) : "unknown";
  const recipientLabels =
    recipients.length > 0
      ? recipients.map((row) => formatUserContact(row)).join(", ")
      : "unknown";

  pushoverAlert(
    "into.now: New message",
    `Sender: ${senderLabel}\nRecipient(s): ${recipientLabels}\n\nMessage:\n${params.body}`
  );
}