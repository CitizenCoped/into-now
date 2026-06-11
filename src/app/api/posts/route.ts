import { getAuthUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim();
  const category = request.nextUrl.searchParams.get("category")?.trim();

  const conditions = [];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(posts.title, pattern), ilike(posts.description, pattern)));
  }

  if (category) {
    conditions.push(eq(posts.category, category));
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

  const authUser = await getAuthUserFromRequest(request);
  const [created] = await getDb()
    .insert(posts)
    .values({
      ...parsed.data,
      authorId: authUser?.id ?? null,
    })
    .returning();
  return NextResponse.json({ post: created }, { status: 201 });
}
