import { getDb } from "@/lib/db";
import { requireManagementAdmin } from "@/lib/managementAuth";
import { getModerationSettings } from "@/lib/moderationSettings";
import { allowRejectedPhoto, serializeReviewCard, upholdRejectedPhoto } from "@/lib/photoReview";
import { userPhotos } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const [photo] = await getDb()
    .select()
    .from(userPhotos)
    .where(eq(userPhotos.id, params.id))
    .limit(1);
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    photo: await serializeReviewCard(photo),
    settings: await getModerationSettings(),
  });
}

const actionSchema = z.object({
  action: z.enum(["allow", "uphold"]),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "action must be allow or uphold" }, { status: 400 });
  }

  const result =
    parsed.data.action === "allow"
      ? await allowRejectedPhoto(params.id, admin.id)
      : await upholdRejectedPhoto(params.id, admin.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ photo: result.card, settings: await getModerationSettings() });
}
