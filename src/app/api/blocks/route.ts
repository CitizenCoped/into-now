import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { userBlocks } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

/** List the ids this user has blocked. */
export async function GET(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getDb()
    .select({ blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, user.id));

  return NextResponse.json({ blockedIds: rows.map((r) => r.blockedId) });
}

/** Block a user. Idempotent. */
export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.userId === user.id) {
    return NextResponse.json({ error: "You can't block yourself" }, { status: 400 });
  }

  await getDb()
    .insert(userBlocks)
    .values({ blockerId: user.id, blockedId: parsed.data.userId })
    .onConflictDoNothing();

  logActivity("user.blocked", {
    userId: user.id,
    phone: user.phone,
    metadata: { blockedId: parsed.data.userId },
  });

  return NextResponse.json({ ok: true });
}

/** Unblock a user. */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await getDb()
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, user.id),
        eq(userBlocks.blockedId, parsed.data.userId)
      )
    );

  logActivity("user.unblocked", {
    userId: user.id,
    phone: user.phone,
    metadata: { unblockedId: parsed.data.userId },
  });

  return NextResponse.json({ ok: true });
}
