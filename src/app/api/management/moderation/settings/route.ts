import { logActivity } from "@/lib/activity";
import { requireManagementAdmin } from "@/lib/managementAuth";
import {
  CLASS_CATALOG,
  isModerationSurface,
  type ModerationSurface,
} from "@/lib/moderationCatalog";
import { getModerationSettings, saveModerationSettings } from "@/lib/moderationSettings";
import { applySettingsToPending, replayWhatIf } from "@/lib/photoReview";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

function surfaceParam(request: NextRequest): ModerationSurface {
  const raw = request.nextUrl.searchParams.get("surface");
  return isModerationSurface(raw) ? raw : "dm";
}

/** GET ?surface=dm|posts — one profile's thresholds + what-if replay. */
export async function GET(request: NextRequest) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const surface = surfaceParam(request);
  const settings = await getModerationSettings(surface);
  return NextResponse.json({
    surface,
    settings,
    catalog: CLASS_CATALOG,
    replay: await replayWhatIf(settings, surface),
  });
}

const putSchema = z.object({
  surface: z.enum(["dm", "posts"]).default("dm"),
  settings: z.record(z.string(), z.object({ enabled: z.boolean(), threshold: z.number() })),
  applyToPending: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  const { surface } = parsed.data;
  const settings = await saveModerationSettings(surface, parsed.data.settings, admin.id);
  logActivity("admin.moderation_settings_updated", {
    metadata: { adminId: admin.id, username: admin.username, surface, settings },
  });

  const applied = parsed.data.applyToPending
    ? await applySettingsToPending(settings, admin.id, surface)
    : null;

  return NextResponse.json({
    surface,
    settings,
    catalog: CLASS_CATALOG,
    replay: await replayWhatIf(settings, surface),
    applied,
  });
}
