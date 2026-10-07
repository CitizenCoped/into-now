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
import {
  MAX_POST_MEDIA,
  MAX_POST_VIDEO_SECONDS,
  MAX_POST_VIDEOS,
} from "@/lib/photoTypes";
import { POST_TTL_MS } from "@/lib/postConfig";
import { withMedia } from "@/lib/postMedia";
import { postPhotos, posts, userPhotos } from "@/lib/schema";
import { and, desc, eq, gt, ilike, inArray, isNull, notInArray, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  posterIs: z.enum(IDENTITY_TOKENS),
  lookingFor: z.enum(LOOKING_FOR_TOKENS),
  lat: z.number(),
  lng: z.number(),
  /** Ordered post media (user_photos ids, purpose = post). */
  mediaIds: z.array(z.string().uuid()).max(MAX_POST_MEDIA).default([]),
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
  return NextResponse.json({ posts: await withMedia(results) });
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
  const { mediaIds, ...postFields } = parsed.data;
  const uniqueMediaIds = Array.from(new Set(mediaIds));
  const db = getDb();

  // Every attached item must be the poster's own `ready` post media, and
  // the mix must fit: ≤4 total, ≤2 videos, each video ≤10s. Anonymous
  // (signed-out) posts can't carry media — there's no owner to check.
  if (uniqueMediaIds.length > 0) {
    if (!authUser) {
      return NextResponse.json(
        { error: "Sign in to add photos to a post" },
        { status: 401 }
      );
    }
    const owned = await db
      .select({
        id: userPhotos.id,
        kind: userPhotos.kind,
        durationMs: userPhotos.durationMs,
      })
      .from(userPhotos)
      .where(
        and(
          inArray(userPhotos.id, uniqueMediaIds),
          eq(userPhotos.userId, authUser.id),
          eq(userPhotos.purpose, "post"),
          eq(userPhotos.status, "ready")
        )
      );
    if (owned.length !== uniqueMediaIds.length) {
      return NextResponse.json(
        { error: "One or more photos aren't available to post" },
        { status: 400 }
      );
    }
    const videos = owned.filter((m) => m.kind === "video");
    if (videos.length > MAX_POST_VIDEOS) {
      return NextResponse.json(
        { error: `Up to ${MAX_POST_VIDEOS} videos per post` },
        { status: 400 }
      );
    }
    if (videos.some((v) => (v.durationMs ?? 0) > MAX_POST_VIDEO_SECONDS * 1000)) {
      return NextResponse.json(
        { error: `Videos must be ${MAX_POST_VIDEO_SECONDS} seconds or less` },
        { status: 400 }
      );
    }
  }

  let created: typeof posts.$inferSelect;
  try {
    [created] = await db
      .insert(posts)
      .values({
        ...postFields,
        category: code,
        authorId: authUser?.id ?? null,
      })
      .returning();

    if (uniqueMediaIds.length > 0) {
      await db.insert(postPhotos).values(
        uniqueMediaIds.map((photoId, index) => ({
          postId: created.id,
          photoId,
          position: index,
        }))
      );
    }
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
      mediaCount: uniqueMediaIds.length,
    },
  });

  const [post] = await withMedia([created]);
  return NextResponse.json({ post }, { status: 201 });
}
