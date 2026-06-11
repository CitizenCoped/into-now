import { getDb } from "@/lib/db";
import {
  conversationParticipants,
  conversations,
  users,
} from "@/lib/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

export async function findOrCreateConversation(userA: string, userB: string) {
  if (userA === userB) {
    throw new Error("Cannot create a conversation with yourself");
  }

  const db = getDb();

  const existing = await db
    .select({ id: conversations.id })
    .from(conversations)
    .innerJoin(
      conversationParticipants,
      eq(conversationParticipants.conversationId, conversations.id)
    )
    .where(inArray(conversationParticipants.userId, [userA, userB]))
    .groupBy(conversations.id)
    .having(sql`count(distinct ${conversationParticipants.userId}) = 2`)
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  const [created] = await db.insert(conversations).values({}).returning({ id: conversations.id });

  await db.insert(conversationParticipants).values([
    { conversationId: created.id, userId: userA },
    { conversationId: created.id, userId: userB },
  ]);

  return created.id;
}

export async function isConversationParticipant(conversationId: string, userId: string) {
  const [row] = await getDb()
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    )
    .limit(1);

  return Boolean(row);
}

export async function getOtherParticipant(conversationId: string, userId: string) {
  const [row] = await getDb()
    .select({ id: users.id, phone: users.phone })
    .from(conversationParticipants)
    .innerJoin(users, eq(users.id, conversationParticipants.userId))
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        sql`${conversationParticipants.userId} <> ${userId}`
      )
    )
    .limit(1);

  return row ?? null;
}