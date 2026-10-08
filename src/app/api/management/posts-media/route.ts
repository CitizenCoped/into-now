import { requireManagementAdmin } from "@/lib/managementAuth";
import { getModerationSettings } from "@/lib/moderationSettings";
import { listPostMedia } from "@/lib/postModeration";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  state: z.enum(["live", "hidden", "held", "expired", "all"]).default("live"),
  kind: z.enum(["photo", "video"]).optional(),
  includeExpired: z.enum(["0", "1"]).default("0"),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

/** GET /api/management/posts-media — everything attached (or once
 *  attached) to the public Posts section, newest first. */
export async function GET(request: NextRequest) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const filter = {
    state: parsed.data.state,
    kind: parsed.data.kind,
    includeExpired: parsed.data.includeExpired === "1",
    before: parsed.data.before ? new Date(parsed.data.before) : undefined,
    limit: parsed.data.limit,
  };

  const { items, nextCursor } = await listPostMedia(filter);
  return NextResponse.json({
    items,
    nextCursor,
    settings: await getModerationSettings("posts"),
    filter: parsed.data,
  });
}
