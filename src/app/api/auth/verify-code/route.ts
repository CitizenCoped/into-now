import {
  AUTH_MAX_AGE_SEC,
  createAuthToken,
  isAdult,
  normalizeEmail,
  normalizePhone,
  serializeAuthUser,
  setAuthCookie,
  userToAuthUser,
} from "@/lib/auth";
import { verifyAuthCode } from "@/lib/authCodes";
import { logActivity } from "@/lib/activity";
import { notifyAdminNewUser, notifyAdminReturningUser } from "@/lib/adminNotify";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { getTwilioClient, getVerifyServiceSid } from "@/lib/twilio";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("phone"),
    phone: z.string().min(7).max(20),
    code: z.string().min(4).max(10),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    channel: z.literal("email"),
    email: z.string().email(),
    code: z.string().min(4).max(10),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification request" }, { status: 400 });
  }

  if (!isAdult(parsed.data.birthDate)) {
    return NextResponse.json({ error: "You must be 18 or older to use Into Now" }, { status: 403 });
  }

  const db = getDb();
  const now = new Date();
  let isNewUser = false;
  let user;

  if (parsed.data.channel === "phone") {
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
    }

    try {
      const client = getTwilioClient();
      const serviceSid = getVerifyServiceSid();

      const check = await client.verify.v2
        .services(serviceSid)
        .verificationChecks.create({ to: phone, code: parsed.data.code });

      if (check.status !== "approved") {
        logActivity("auth.verify_failed", { phone, metadata: { reason: "invalid_code" } });
        return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
      }
    } catch (error) {
      console.error("Twilio verify-code error:", error);
      logActivity("auth.verify_failed", { phone, metadata: { reason: "twilio_error" } });
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

    if (!existing) {
      const [created] = await db
        .insert(users)
        .values({
          phone,
          authMethod: "phone",
          isAnonymous: false,
          birthDate: parsed.data.birthDate,
          ageVerifiedAt: now,
        })
        .returning();
      user = created;
      isNewUser = true;
    } else {
      const [updated] = await db
        .update(users)
        .set({
          birthDate: parsed.data.birthDate,
          ageVerifiedAt: now,
          isAnonymous: false,
          expiresAt: null,
          authMethod: "phone",
        })
        .where(eq(users.id, existing.id))
        .returning();
      user = updated;
    }

    if (isNewUser) {
      notifyAdminNewUser(phone);
      logActivity("user.signup", { userId: user.id, phone });
    } else {
      notifyAdminReturningUser(phone);
      logActivity("user.login", { userId: user.id, phone });
    }
  } else {
    const email = normalizeEmail(parsed.data.email);
    if (!email) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const valid = await verifyAuthCode("email", email, parsed.data.code);
    if (!valid) {
      logActivity("auth.verify_failed", { metadata: { email, reason: "invalid_code" } });
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!existing) {
      const [created] = await db
        .insert(users)
        .values({
          email,
          authMethod: "email",
          isAnonymous: false,
          birthDate: parsed.data.birthDate,
          ageVerifiedAt: now,
        })
        .returning();
      user = created;
      isNewUser = true;
    } else {
      const [updated] = await db
        .update(users)
        .set({
          birthDate: parsed.data.birthDate,
          ageVerifiedAt: now,
          isAnonymous: false,
          expiresAt: null,
          authMethod: "email",
        })
        .where(eq(users.id, existing.id))
        .returning();
      user = updated;
    }

    if (isNewUser) {
      notifyAdminNewUser(email);
      logActivity("user.signup", { userId: user.id, metadata: { email } });
    } else {
      notifyAdminReturningUser(email);
      logActivity("user.login", { userId: user.id, metadata: { email } });
    }
  }

  const authUser = userToAuthUser(user);
  const token = await createAuthToken(
    { userId: authUser.id, authMethod: authUser.authMethod, isAnonymous: false },
    AUTH_MAX_AGE_SEC
  );
  const response = NextResponse.json({ user: serializeAuthUser(authUser) });
  setAuthCookie(response, token, AUTH_MAX_AGE_SEC);
  return response;
}