import { getAuthUserFromRequest } from "@/lib/auth";
import { notifyNearbyConversationPartners } from "@/lib/presencePush";
import { getDb } from "@/lib/db";
import {
  PRESENCE_CHANNEL,
  PRESENCE_EVENT,
  PRESENCE_TTL_MS,
  getPusherServer,
} from "@/lib/pusher";
import { liveSessions } from "@/lib/schema";
import { gt, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const presenceSchema = z.object({
  sessionId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  status: z.enum(["online", "offline"]).optional(),
});

export async function GET() {
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);
  const sessions = await getDb()
    .select()
    .from(liveSessions)
    .where(gt(liveSessions.lastSeenAt, cutoff));

  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = presenceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sessionId, lat, lng, status = "online" } = parsed.data;
  const authUser = await getAuthUserFromRequest(request);
  const now = new Date();

  if (status === "offline") {
    await getDb().delete(liveSessions).where(sql`${liveSessions.id} = ${sessionId}`);
  } else {
    await getDb()
      .insert(liveSessions)
      .values({
        id: sessionId,
        lat,
        lng,
        userId: authUser?.id ?? null,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: liveSessions.id,
        set: {
          lat,
          lng,
          userId: authUser?.id ?? null,
          lastSeenAt: now,
        },
      });
  }

  const pusher = getPusherServer();
  if (pusher) {
    await pusher.trigger(PRESENCE_CHANNEL, PRESENCE_EVENT, {
      sessionId,
      userId: authUser?.id ?? null,
      lat,
      lng,
      status,
      lastSeenAt: now.toISOString(),
    });
  }

  if (status !== "offline" && authUser) {
    await notifyNearbyConversationPartners({
      userId: authUser.id,
      phone: authUser.phone,
      lat,
      lng,
    });
  }

  return NextResponse.json({ ok: true });
}