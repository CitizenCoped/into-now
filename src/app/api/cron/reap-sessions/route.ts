import { getDb } from "@/lib/db";
import { SESSION_REAP_AGE_MS } from "@/lib/presenceConfig";
import { liveSessions } from "@/lib/schema";
import { lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET;
  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - SESSION_REAP_AGE_MS);
  const db = getDb();
  await db.delete(liveSessions).where(lt(liveSessions.lastSeenAt, cutoff));

  return NextResponse.json({ ok: true });
}
