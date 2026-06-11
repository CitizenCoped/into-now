import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { pushPreferences, pushSubscriptions } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  notifyMessages: z.boolean().optional(),
  notifyPresence: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [prefs] = await getDb()
    .select()
    .from(pushPreferences)
    .where(eq(pushPreferences.userId, user.id))
    .limit(1);

  const subs = await getDb()
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));

  return NextResponse.json({
    subscribed: subs.length > 0,
    preferences: prefs ?? { notifyMessages: true, notifyPresence: true },
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();

  await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: user.id,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });

  const [existingPrefs] = await db
    .select()
    .from(pushPreferences)
    .where(eq(pushPreferences.userId, user.id))
    .limit(1);

  const notifyMessages = parsed.data.notifyMessages ?? existingPrefs?.notifyMessages ?? true;
  const notifyPresence = parsed.data.notifyPresence ?? existingPrefs?.notifyPresence ?? true;

  await db
    .insert(pushPreferences)
    .values({
      userId: user.id,
      notifyMessages,
      notifyPresence,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pushPreferences.userId,
      set: { notifyMessages, notifyPresence, updatedAt: now },
    });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const prefsSchema = z.object({
    notifyMessages: z.boolean().optional(),
    notifyPresence: z.boolean().optional(),
  });
  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(pushPreferences)
    .where(eq(pushPreferences.userId, user.id))
    .limit(1);

  const notifyMessages = parsed.data.notifyMessages ?? existing?.notifyMessages ?? true;
  const notifyPresence = parsed.data.notifyPresence ?? existing?.notifyPresence ?? true;

  await db
    .insert(pushPreferences)
    .values({
      userId: user.id,
      notifyMessages,
      notifyPresence,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushPreferences.userId,
      set: { notifyMessages, notifyPresence, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true, preferences: { notifyMessages, notifyPresence } });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;

  const db = getDb();
  if (endpoint) {
    await db
      .delete(pushSubscriptions)
      .where(sql`${pushSubscriptions.userId} = ${user.id} AND ${pushSubscriptions.endpoint} = ${endpoint}`);
  } else {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
  }

  return NextResponse.json({ ok: true });
}