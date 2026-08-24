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

const v2Schema = z.discriminatedUnion("channel", [
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

const legacyPhoneSchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().min(4).max(10),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const schema = z.union([v2Schema, legacyPhoneSchema]);

async function verifyTwilioCode(phone: string, code: string) {
  const client = getTwilioClient();
  const serviceSid = getVerifyServiceSid();

  const check = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({ to: phone, code });

  return check.status === "approved";
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification request" }, { status: 400 });
  }

  const birthDate = "birthDate" in parsed.data ? parsed.data.birthDate : undefined;

  if (birthDate && !isAdult(birthDate)) {
    return NextResponse.json({ error: "You must be 18 or older to use Into Now" }, { status: 403 });
  }

  const db = getDb();
  const now = new Date();
  let isNewUser = false;
  let user;

  if ("phone" in parsed.data) {
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
    }

    try {
      const approved = await verifyTwilioCode(phone, parsed.data.code);
      if (!approved) {
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
          ...(birthDate
            ? { birthDate, ageVerifiedAt: now }
            : {}),
        })
        .returning();
      user = created;
      isNewUser = true;
    } else {
      const updates: Partial<typeof users.$inferInsert> = {
        isAnonymous: false,
        expiresAt: null,
        authMethod: "phone",
      };
      if (birthDate) {
        updates.birthDate = birthDate;
        updates.ageVerifiedAt = now;
      }

      const [updated] = await db
        .update(users)
        .set(updates)
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
  } else if ("email" in parsed.data) {
    if (!birthDate) {
      return NextResponse.json({ error: "Invalid verification request" }, { status: 400 });
    }

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
          birthDate: birthDate!,
          ageVerifiedAt: now,
        })
        .returning();
      user = created;
      isNewUser = true;
    } else {
      const [updated] = await db
        .update(users)
        .set({
          birthDate: birthDate!,
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
  } else {
    return NextResponse.json({ error: "Invalid verification request" }, { status: 400 });
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