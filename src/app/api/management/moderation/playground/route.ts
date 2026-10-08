import { requireManagementAdmin } from "@/lib/managementAuth";
import { isModerationConfigured, scanImageBytes, scanImageUrl } from "@/lib/moderation";
import {
  CLASS_CATALOG,
  isModerationSurface,
  type ModerationSurface,
} from "@/lib/moderationCatalog";
import { getModerationSettings } from "@/lib/moderationSettings";
import { NextRequest, NextResponse } from "next/server";

const MAX_PLAYGROUND_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  if (!isModerationConfigured()) {
    return NextResponse.json({ error: "Sightengine is not configured" }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  // Which threshold profile to judge against; defaults to DM.
  let surface: ModerationSurface = "dm";
  let result;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const requested = form.get("surface");
      if (isModerationSurface(requested)) surface = requested;
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      if (file.size > MAX_PLAYGROUND_BYTES) {
        return NextResponse.json({ error: "File is too large" }, { status: 400 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      result = await scanImageBytes(bytes, file.name || "photo.jpg", { surface });
    } else {
      const body = (await request.json().catch(() => null)) as
        | { url?: string; surface?: unknown }
        | null;
      if (isModerationSurface(body?.surface)) surface = body.surface;
      const url = body?.url?.trim();
      if (!url || !/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: "A public https image URL is required" }, { status: 400 });
      }
      result = await scanImageUrl(url, { surface });
    }
  } catch (error) {
    console.error("playground scan failed:", error);
    return NextResponse.json({ error: "Sightengine scan failed" }, { status: 502 });
  }

  return NextResponse.json({
    result,
    surface,
    settings: await getModerationSettings(surface),
    catalog: CLASS_CATALOG,
  });
}
