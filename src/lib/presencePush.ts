import { maskPhone } from "@/lib/auth";
import { distanceKm, NEARBY_RADIUS_KM } from "@/lib/geo";
import { getDb } from "@/lib/db";
import { getPushPreferences, sendPushToUser } from "@/lib/push";
import { PRESENCE_TTL_MS } from "@/lib/pusher";
import {
  conversationParticipants,
  liveSessions,
  presencePushLog,
} from "@/lib/schema";
import { and, eq, gt, inArray, ne } from "drizzle-orm";

const PRESENCE_PUSH_COOLDOWN_MS = 60 * 60 * 1000;

export async function notifyNearbyConversationPartners(params: {
  userId: string;
  phone: string;
  lat: number;
  lng: number;
}) {
  const db = getDb();
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);

  const myConversations = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, params.userId));

  const conversationIds = myConversations.map((row) => row.conversationId);
  if (conversationIds.length === 0) return;

  const partners = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(
      and(
        inArray(conversationParticipants.conversationId, conversationIds),
        ne(conversationParticipants.userId, params.userId)
      )
    );

  const partnerIds = Array.from(new Set(partners.map((row) => row.userId)));
  if (partnerIds.length === 0) return;

  const activeSessions = await db
    .select()
    .from(liveSessions)
    .where(and(inArray(liveSessions.userId, partnerIds), gt(liveSessions.lastSeenAt, cutoff)));

  const nearbyRecipients = activeSessions.filter((session) => {
    if (!session.userId || session.userId === params.userId) return false;
    return distanceKm(params.lat, params.lng, session.lat, session.lng) <= NEARBY_RADIUS_KM;
  });

  const masked = maskPhone(params.phone);
  const now = new Date();

  for (const session of nearbyRecipients) {
    if (!session.userId) continue;

    const prefs = await getPushPreferences(session.userId);
    if (!prefs.notifyPresence) continue;

    const [log] = await db
      .select()
      .from(presencePushLog)
      .where(
        and(
          eq(presencePushLog.recipientId, session.userId),
          eq(presencePushLog.senderId, params.userId)
        )
      )
      .limit(1);

    if (log && now.getTime() - new Date(log.lastSentAt).getTime() < PRESENCE_PUSH_COOLDOWN_MS) {
      continue;
    }

    await sendPushToUser(session.userId, {
      title: "Someone you chat with is nearby",
      body: `${masked} is live on the map now`,
      url: "/",
      tag: `presence-${params.userId}`,
    });

    await db
      .insert(presencePushLog)
      .values({
        recipientId: session.userId,
        senderId: params.userId,
        lastSentAt: now,
      })
      .onConflictDoUpdate({
        target: [presencePushLog.recipientId, presencePushLog.senderId],
        set: { lastSentAt: now },
      });
  }
}