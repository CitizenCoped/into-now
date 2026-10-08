import { getDb } from "@/lib/db";
import { requireManagementAdmin } from "@/lib/managementAuth";
import { isModerationSurface, purposeForSurface } from "@/lib/moderationCatalog";
import { getAllModerationSettings } from "@/lib/moderationSettings";
import { serializeReviewCard, type ReviewStatus } from "@/lib/photoReview";
import { userPhotos } from "@/lib/schema";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const STATUSES = new Set<ReviewStatus>(["pending", "upheld", "overturned", "expired"]);

export async function GET(request: NextRequest) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const raw = request.nextUrl.searchParams.get("status") ?? "pending";
  const status = STATUSES.has(raw as ReviewStatus) ? (raw as ReviewStatus) : "pending";

  // Optional surface filter: DM library photos vs post media.
  const surfaceRaw = request.nextUrl.searchParams.get("surface");
  const surface = isModerationSurface(surfaceRaw) ? surfaceRaw : "all";

  const rows = await getDb()
    .select()
    .from(userPhotos)
    .where(
      surface === "all"
        ? eq(userPhotos.reviewStatus, status)
        : and(eq(userPhotos.reviewStatus, status), eq(userPhotos.purpose, purposeForSurface(surface)))
    )
    .orderBy(desc(userPhotos.createdAt))
    .limit(100);

  const photos = await Promise.all(rows.map((row) => serializeReviewCard(row)));
  const settings = await getAllModerationSettings();

  return NextResponse.json({ photos, settings, status, surface });
}
