import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { fetchMapUsers } from "@/lib/mapUsers";
import { notifyNearbyUsers } from "@/lib/presencePush";
import { getDb } from "@/lib/db";
import {
  PRESENCE_CHANNEL,
  PRESENCE_EVENT,
  getPusherServer,
} from "@/lib/pusher";
import { SERVER_MIN_UPDATE_MS } from "@/lib/presenceConfig";
import { liveSessions, users } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const presenceSchema = z.object({
  sessionId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  status: z.enum(["online", "offline"]).optional(),
});

export async function GET() {
  const { lit, unlit } = await fetchMapUsers();
  return NextResponse.json({ lit, unlit, sessions: lit });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = presenceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, lat, lng, status = "online" } = parsed.data;
  const now = new Date();
  const db = getDb();

  let isNewSession = false;

  if (status === "offline") {
    await db
      .update(users)
      .set({ lastLat: lat, lastLng: lng, lastLocationAt: now })
      .where(eq(users.id, authUser.id));

    await db.delete(liveSessions).where(sql`${liveSessions.id} = ${sessionId}`);

    logActivity("presence.offline", {
      userId: authUser.id,
      phone: authUser.phone,
      metadata: { sessionId },
    });
  } else {
    const [existing] = await db
      .select({ id: liveSessions.id, lastSeenAt: liveSessions.lastSeenAt })
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);

    isNewSession = !existing;

    if (
      existing &&
      now.getTime() - existing.lastSeenAt.getTime() < SERVER_MIN_UPDATE_MS
    ) {
      return NextResponse.json({ ok: true, coalesced: true });
    }

    await db
      .insert(liveSessions)
      .values({
        id: sessionId,
        lat,
        lng,
        userId: authUser.id,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: liveSessions.id,
        set: {
          lat,
          lng,
          userId: authUser.id,
          lastSeenAt: now,
        },
      });

    await db
      .update(users)
      .set({ lastLat: lat, lastLng: lng, lastLocationAt: now })
      .where(eq(users.id, authUser.id));
  }

  const pusher = getPusherServer();
  if (pusher) {
    await pusher.trigger(PRESENCE_CHANNEL, PRESENCE_EVENT, {
      sessionId,
      userId: authUser.id,
      lat,
      lng,
      status,
      displayName: authUser.displayName,
      photoUrl: authUser.photoUrl,
      statement: authUser.statement,
      isAnonymous: authUser.isAnonymous,
      birthDate: authUser.birthDate,
      lastSeenAt: now.toISOString(),
    });
  }

  if (status !== "offline" && !authUser.isAnonymous) {
    if (isNewSession) {
      logActivity("presence.online", {
        userId: authUser.id,
        phone: authUser.phone,
        metadata: { sessionId, lat, lng },
      });
    }

    await notifyNearbyUsers({
      userId: authUser.id,
      displayName: authUser.displayName,
      phone: authUser.phone,
      lat,
      lng,
      isNewSession,
    });
  }

  return NextResponse.json({ ok: true });
}