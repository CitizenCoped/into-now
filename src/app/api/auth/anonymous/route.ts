import {
  AUTH_ANON_MAX_AGE_SEC,
  createAuthToken,
  isAdult,
  serializeAuthUser,
  setAuthCookie,
  userToAuthUser,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Birth date is required" }, { status: 400 });
  }

  if (!isAdult(parsed.data.birthDate)) {
    return NextResponse.json({ error: "You must be 18 or older to use Into Now" }, { status: 403 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTH_ANON_MAX_AGE_SEC * 1000);

  const [created] = await getDb()
    .insert(users)
    .values({
      authMethod: "anonymous",
      isAnonymous: true,
      birthDate: parsed.data.birthDate,
      ageVerifiedAt: now,
      expiresAt,
    })
    .returning();

  const authUser = userToAuthUser(created);
  const token = await createAuthToken(
    { userId: authUser.id, authMethod: "anonymous", isAnonymous: true },
    AUTH_ANON_MAX_AGE_SEC
  );

  logActivity("user.anonymous", { userId: created.id, metadata: { expiresAt: expiresAt.toISOString() } });

  const response = NextResponse.json({ user: serializeAuthUser(authUser) });
  setAuthCookie(response, token, AUTH_ANON_MAX_AGE_SEC);
  return response;
}