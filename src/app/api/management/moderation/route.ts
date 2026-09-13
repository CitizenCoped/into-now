import { getDb } from "@/lib/db";
import { requireManagementAdmin } from "@/lib/managementAuth";
import { getModerationSettings } from "@/lib/moderationSettings";
import { serializeReviewCard, type ReviewStatus } from "@/lib/photoReview";
import { userPhotos } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const STATUSES = new Set<ReviewStatus>(["pending", "upheld", "overturned", "expired"]);

export async function GET(request: NextRequest) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const raw = request.nextUrl.searchParams.get("status") ?? "pending";
  const status = STATUSES.has(raw as ReviewStatus) ? (raw as ReviewStatus) : "pending";

  const rows = await getDb()
    .select()
    .from(userPhotos)
    .where(eq(userPhotos.reviewStatus, status))
    .orderBy(desc(userPhotos.createdAt))
    .limit(100);

  const photos = await Promise.all(rows.map((row) => serializeReviewCard(row)));
  const settings = await getModerationSettings();

  return NextResponse.json({ photos, settings, status });
}
