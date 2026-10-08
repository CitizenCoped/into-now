import { requireManagementAdmin } from "@/lib/managementAuth";
import { getModerationSettings } from "@/lib/moderationSettings";
import {
  getPostMediaCard,
  rescanPostMedia,
  restorePostMedia,
  takeDownPostMedia,
} from "@/lib/postModeration";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const item = await getPostMediaCard(params.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ item, settings: await getModerationSettings("posts") });
}

const actionSchema = z.object({
  action: z.enum(["takedown", "restore", "rescan"]),
  reason: z.string().trim().max(500).optional(),
});

/** POST — take down / restore a single media item, or re-scan it against
 *  the current Posts profile (re-scan never changes visibility). */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "action must be takedown, restore, or rescan" },
      { status: 400 }
    );
  }

  const reason = parsed.data.reason?.trim() || null;
  const result =
    parsed.data.action === "takedown"
      ? await takeDownPostMedia(params.id, admin.id, reason)
      : parsed.data.action === "restore"
        ? await restorePostMedia(params.id, admin.id)
        : await rescanPostMedia(params.id, admin.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    item: result.card,
    settings: await getModerationSettings("posts"),
    decision: "decision" in result ? result.decision : undefined,
  });
}
