import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { pushoverAlert } from "@/lib/pushover";
import { posts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  reason: z.string().max(500).optional(),
});

type RouteContext = {
  params: { id: string };
};

/**
 * Report a post. Any signed-in user (anonymous included) can report;
 * writes the moderation audit trail and pings the admin immediately.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [post] = await getDb()
    .select({
      id: posts.id,
      title: posts.title,
      category: posts.category,
      authorId: posts.authorId,
    })
    .from(posts)
    .where(eq(posts.id, params.id))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  logActivity("post.reported", {
    userId: user.id,
    phone: user.phone,
    metadata: {
      postId: post.id,
      postTitle: post.title,
      postAuthorId: post.authorId,
      reason: parsed.data.reason ?? null,
    },
  });

  void pushoverAlert(
    "into.now: Post reported",
    [
      `Post: [${post.category}] ${post.title}`,
      `Post id: ${post.id}`,
      parsed.data.reason ? `Reason: ${parsed.data.reason}` : null,
      `Reporter: ${user.id}`,
    ]
      .filter(Boolean)
      .join("\n")
  );

  return NextResponse.json({ ok: true });
}
