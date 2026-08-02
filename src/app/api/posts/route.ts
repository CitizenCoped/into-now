import { logActivity } from "@/lib/activity";
import { notifyAdminNewPost } from "@/lib/adminNotify";
import { getAuthUserFromRequest } from "@/lib/auth";
import { getHiddenUserIds } from "@/lib/blocks";
import {
  IDENTITY_TOKENS,
  LOOKING_FOR_TOKENS,
  composeCode,
  isIdentityToken,
  isLookingForToken,
} from "@/lib/codes";
import {
  findSolicitationSignal,
  SOLICITATION_REJECTION_MESSAGE,
} from "@/lib/contentScreens";
import { getDb } from "@/lib/db";
import { POST_TTL_MS } from "@/lib/postConfig";
import { posts } from "@/lib/schema";
import { and, desc, eq, gt, ilike, isNull, notInArray, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  posterIs: z.enum(IDENTITY_TOKENS),
  lookingFor: z.enum(LOOKING_FOR_TOKENS),
  lat: z.number(),
  lng: z.number(),
});

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim();
  const posterIs = request.nextUrl.searchParams.get("posterIs")?.trim();
  const lookingFor = request.nextUrl.searchParams.get("lookingFor")?.trim();

  const conditions = [];

  // Posts are ephemeral: only the last 24h surface, even before the
  // expiry cron physically deletes older rows.
  conditions.push(gt(posts.createdAt, new Date(Date.now() - POST_TTL_MS)));

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(posts.title, pattern), ilike(posts.description, pattern)));
  }

  if (posterIs && isIdentityToken(posterIs)) {
    conditions.push(eq(posts.posterIs, posterIs));
  }

  if (lookingFor && isLookingForToken(lookingFor)) {
    conditions.push(eq(posts.lookingFor, lookingFor));
  }

  // Mutual invisibility: hide posts from anyone in a block relationship
  // with the viewer (either direction). Anonymous-author posts stay visible.
  const viewer = await getAuthUserFromRequest(request);
  if (viewer) {
    const hidden = await getHiddenUserIds(viewer.id);
    if (hidden.length > 0) {
      conditions.push(or(isNull(posts.authorId), notInArray(posts.authorId, hidden)));
    }
  }

  const results = await getDb().select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt));
  return NextResponse.json({ posts: results });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { posterIs, lookingFor } = parsed.data;

  // FOSTA line: no commercial solicitation. Adult expression stays free.
  const signal = findSolicitationSignal(`${parsed.data.title}\n${parsed.data.description}`);
  if (signal) {
    logActivity("post.rejected_solicitation", {
      userId: null,
      phone: null,
      metadata: { signal, titlePreview: parsed.data.title.slice(0, 80) },
    });
    return NextResponse.json({ error: SOLICITATION_REJECTION_MESSAGE }, { status: 400 });
  }

  // The derived code lives in the legacy `category` column so admin
  // notifications, activity logs, and existing queries keep working.
  const code = composeCode(posterIs, lookingFor);

  const authUser = await getAuthUserFromRequest(request);

  let created;
  try {
    [created] = await getDb()
      .insert(posts)
      .values({
        ...parsed.data,
        category: code,
        authorId: authUser?.id ?? null,
      })
      .returning();
  } catch (err) {
    console.error("post.create failed:", err);
    return NextResponse.json(
      { error: "Couldn't save your post — the server hit a database error." },
      { status: 500 }
    );
  }

  void notifyAdminNewPost({
    authorId: created.authorId,
    title: created.title,
    category: created.category,
    description: created.description,
  });

  logActivity("post.created", {
    userId: authUser?.id ?? null,
    phone: authUser?.phone ?? null,
    metadata: {
      postId: created.id,
      title: created.title,
      code: created.category,
      posterIs: created.posterIs,
      lookingFor: created.lookingFor,
      anonymous: !authUser,
    },
  });

  return NextResponse.json({ post: created }, { status: 201 });
}
