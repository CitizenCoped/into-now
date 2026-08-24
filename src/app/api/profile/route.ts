import { getAuthUserFromRequest, serializeAuthUser, userToAuthUser } from "@/lib/auth";
import { IDENTITY_TOKENS } from "@/lib/codes";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  statement: z.string().min(1).max(280).optional(),
  photoUrl: z.string().url().optional(),
  identity: z.enum(IDENTITY_TOKENS).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user: serializeAuthUser(user) });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Partial<typeof users.$inferInsert> = {};
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.statement !== undefined) updates.statement = parsed.data.statement;
  if (parsed.data.photoUrl !== undefined) updates.photoUrl = parsed.data.photoUrl;
  if (parsed.data.identity !== undefined) updates.identity = parsed.data.identity;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const [updated] = await getDb()
    .update(users)
    .set(updates)
    .where(eq(users.id, user.id))
    .returning();

  return NextResponse.json({ user: serializeAuthUser(userToAuthUser(updated)) });
}