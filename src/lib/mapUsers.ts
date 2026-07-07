import { and, eq, gt, isNotNull, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { PRESENCE_TTL_MS } from "@/lib/pusher";
import { liveSessions, users, type MapUser } from "@/lib/schema";

export async function fetchMapUsers(): Promise<{ lit: MapUser[]; unlit: MapUser[] }> {
  const db = getDb();
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);
  const now = new Date();

  const litRows = await db
    .select({
      sessionId: liveSessions.id,
      userId: liveSessions.userId,
      lat: liveSessions.lat,
      lng: liveSessions.lng,
      lastSeenAt: liveSessions.lastSeenAt,
      displayName: users.displayName,
      photoUrl: users.photoUrl,
      statement: users.statement,
      isAnonymous: users.isAnonymous,
      birthDate: users.birthDate,
      expiresAt: users.expiresAt,
    })
    .from(liveSessions)
    .innerJoin(users, sql`${liveSessions.userId} = ${users.id}`)
    .where(gt(liveSessions.lastSeenAt, cutoff));

  const litUserIds = litRows
    .map((row) => row.userId)
    .filter((id): id is string => Boolean(id));

  const unlitConditions = [
    isNotNull(users.lastLat),
    isNotNull(users.lastLng),
    or(eq(users.isAnonymous, false), gt(users.expiresAt, now)),
  ];

  if (litUserIds.length > 0) {
    unlitConditions.push(notInArray(users.id, litUserIds));
  }

  const unlitRows = await db
    .select({
      userId: users.id,
      lat: users.lastLat,
      lng: users.lastLng,
      lastLocationAt: users.lastLocationAt,
      displayName: users.displayName,
      photoUrl: users.photoUrl,
      statement: users.statement,
      isAnonymous: users.isAnonymous,
      birthDate: users.birthDate,
    })
    .from(users)
    .where(and(...unlitConditions));

  const lit: MapUser[] = litRows
    .filter((row) => row.userId)
    .map((row) => ({
      id: row.userId!,
      userId: row.userId!,
      lat: row.lat,
      lng: row.lng,
      isLit: true,
      displayName: row.displayName,
      photoUrl: row.photoUrl,
      statement: row.statement,
      isAnonymous: row.isAnonymous,
      birthDate: row.birthDate,
      lastSeenAt: row.lastSeenAt,
    }));

  const unlit: MapUser[] = unlitRows
    .filter((row) => row.lat != null && row.lng != null)
    .map((row) => ({
      id: row.userId,
      userId: row.userId,
      lat: row.lat!,
      lng: row.lng!,
      isLit: false,
      displayName: row.displayName,
      photoUrl: row.photoUrl,
      statement: row.statement,
      isAnonymous: row.isAnonymous,
      birthDate: row.birthDate,
      lastSeenAt: row.lastLocationAt,
    }));

  return { lit, unlit };
}