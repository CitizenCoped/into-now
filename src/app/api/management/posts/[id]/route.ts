import { requireManagementAdmin } from "@/lib/managementAuth";
import { hidePost, unhidePost } from "@/lib/postModeration";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: { id: string } };

const actionSchema = z.object({
  action: z.enum(["hide", "unhide"]),
  reason: z.string().trim().max(500).optional(),
});

/** POST — hide / unhide an entire post (text + all media) from the public
 *  feed, map, and thread reference row. Reversible. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { admin, response } = await requireManagementAdmin(request);
  if (!admin) return response;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "action must be hide or unhide" }, { status: 400 });
  }

  const reason = parsed.data.reason?.trim() || null;
  const result =
    parsed.data.action === "hide"
      ? await hidePost(params.id, admin.id, reason)
      : await unhidePost(params.id, admin.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ post: result.post });
}
