import { requireManagementAdmin } from "@/lib/managementAuth";
import { isModerationConfigured, scanImageBytes, scanImageUrl } from "@/lib/moderation";
import { CLASS_CATALOG } from "@/lib/moderationCatalog";
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
  let result;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      if (file.size > MAX_PLAYGROUND_BYTES) {
        return NextResponse.json({ error: "File is too large" }, { status: 400 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      result = await scanImageBytes(bytes, file.name || "photo.jpg");
    } else {
      const body = (await request.json().catch(() => null)) as { url?: string } | null;
      const url = body?.url?.trim();
      if (!url || !/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: "A public https image URL is required" }, { status: 400 });
      }
      result = await scanImageUrl(url);
    }
  } catch (error) {
    console.error("playground scan failed:", error);
    return NextResponse.json({ error: "Sightengine scan failed" }, { status: 502 });
  }

  return NextResponse.json({
    result,
    settings: await getModerationSettings(),
    catalog: CLASS_CATALOG,
  });
}
