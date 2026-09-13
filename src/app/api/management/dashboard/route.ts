import { getDb } from "@/lib/db";
import { requireManagementAdmin } from "@/lib/managementAuth";
import { isModerationConfigured } from "@/lib/moderation";
import { activityLog, userPhotos } from "@/lib/schema";
import { and, count, eq, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const db = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [pending] = await db
    .select({ n: count() })
    .from(userPhotos)
    .where(eq(userPhotos.reviewStatus, "pending"));

  async function actionCount(action: string) {
    const [row] = await db
      .select({ n: count() })
      .from(activityLog)
      .where(and(eq(activityLog.action, action), gte(activityLog.createdAt, since)));
    return Number(row?.n ?? 0);
  }

  return NextResponse.json({
    pendingCount: Number(pending?.n ?? 0),
    sightengineConfigured: isModerationConfigured(),
    last24h: {
      autoApproved: await actionCount("photo.approved"),
      autoRejected: await actionCount("photo.rejected"),
      allowed: await actionCount("admin.photo_allowed"),
      upheld: await actionCount("admin.photo_upheld"),
    },
  });
}
