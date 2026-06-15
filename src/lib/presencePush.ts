import { getDisplayLabel } from "@/lib/auth";
import { distanceKm, NEARBY_RADIUS_KM } from "@/lib/geo";
import { getDb } from "@/lib/db";
import { getPushPreferences, sendPushToUser } from "@/lib/push";
import { PRESENCE_TTL_MS } from "@/lib/pusher";
import { liveSessions } from "@/lib/schema";
import { and, gt, ne, sql } from "drizzle-orm";

export async function notifyNearbyUsers(params: {
  userId: string;
  displayName: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  isNewSession: boolean;
}) {
  if (!params.isNewSession) return;

  const db = getDb();
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);

  const activeSessions = await db
    .select()
    .from(liveSessions)
    .where(
      and(
        gt(liveSessions.lastSeenAt, cutoff),
        sql`${liveSessions.userId} IS NOT NULL`,
        ne(liveSessions.userId, params.userId)
      )
    );

  const nearbyRecipients = activeSessions.filter((session) => {
    if (!session.userId) return false;
    return distanceKm(params.lat, params.lng, session.lat, session.lng) <= NEARBY_RADIUS_KM;
  });

  const label = getDisplayLabel({
    displayName: params.displayName,
    phone: params.phone,
  });

  await Promise.all(
    nearbyRecipients.map(async (session) => {
      if (!session.userId) return;

      const prefs = await getPushPreferences(session.userId);
      if (!prefs.notifyPresence) return;

      await sendPushToUser(session.userId, {
        title: "Someone new is nearby",
        body: `${label} just went live on the map`,
        url: "/",
        tag: `presence-${params.userId}-${session.userId}`,
      });
    })
  );
}