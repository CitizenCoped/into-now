import { logActivity } from "@/lib/activity";
import { notifyAdminNewPost } from "@/lib/adminNotify";
import { getAuthUserFromRequest } from "@/lib/auth";
import {
  IDENTITY_TOKENS,
  LOOKING_FOR_TOKENS,
  composeCode,
  isIdentityToken,
  isLookingForToken,
} from "@/lib/codes";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
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

  const results = await getDb().select()
    .from(posts)
    .where(conditions.length ? and(...conditions) : undefined)
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
