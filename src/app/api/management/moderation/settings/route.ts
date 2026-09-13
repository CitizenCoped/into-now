import { logActivity } from "@/lib/activity";
import { requireManagementAdmin } from "@/lib/managementAuth";
import { CLASS_CATALOG } from "@/lib/moderationCatalog";
import { getModerationSettings, saveModerationSettings } from "@/lib/moderationSettings";
import { applySettingsToPending, replayWhatIf } from "@/lib/photoReview";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const settings = await getModerationSettings();
  return NextResponse.json({
    settings,
    catalog: CLASS_CATALOG,
    replay: await replayWhatIf(settings),
  });
}

const putSchema = z.object({
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

  const settings = await saveModerationSettings(parsed.data.settings, admin.id);
  logActivity("admin.moderation_settings_updated", {
    metadata: { adminId: admin.id, username: admin.username, settings },
  });

  const applied = parsed.data.applyToPending
    ? await applySettingsToPending(settings, admin.id)
    : null;

  return NextResponse.json({
    settings,
    catalog: CLASS_CATALOG,
    replay: await replayWhatIf(settings),
    applied,
  });
}
