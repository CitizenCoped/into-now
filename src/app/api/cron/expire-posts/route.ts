import { getDb } from "@/lib/db";
import { POST_TTL_MS } from "@/lib/postConfig";
import { posts } from "@/lib/schema";
import { lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * Deletes posts older than the 24h TTL. The posts GET already hides them
 * at read time; this cron keeps the table itself lean and honors the
 * ephemerality promise (nothing accumulates).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET;
  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - POST_TTL_MS);
  await getDb().delete(posts).where(lt(posts.createdAt, cutoff));

  return NextResponse.json({ ok: true });
}
