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

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * `birthDate` is optional on purpose: sign-up sends it (the landing age gate
 * collected it), sign-in omits it because the account already carries one.
 * Without a birth date we never create an account and never overwrite a
 * stored one.
 */
const v2Schema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("phone"),
    phone: z.string().min(7).max(20),
    code: z.string().min(4).max(10),
    birthDate: dateStr.optional(),
  }),
  z.object({
    channel: z.literal("email"),
    email: z.string().email(),
    code: z.string().min(4).max(10),
    birthDate: dateStr.optional(),
  }),
]);

const legacyPhoneSchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().min(4).max(10),
  birthDate: dateStr.optional(),
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

/** Sign-in for a contact with no account: refuse to create one without a birth date. */
function noAccountResponse(channel: "phone" | "email") {
  return NextResponse.json(
    {
      error: `No account found for that ${channel === "phone" ? "number" : "email"}. Sign up first.`,
      code: "NO_ACCOUNT",
    },
    { status: 404 }
  );
}

/** Legacy account that never age-verified: the client must collect the birth date. */
function ageRequiredResponse() {
  return NextResponse.json(
    { error: "Confirm your birthday to finish signing in.", code: "AGE_REQUIRED" },
    { status: 403 }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification request" }, { status: 400 });
  }

  const birthDate = parsed.data.birthDate;

  if (birthDate && !isAdult(birthDate)) {
    return NextResponse.json({ error: "You must be 18 or older to use The Best Drug" }, { status: 403 });
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

    // Verify the code before looking the account up so that an unauthenticated
    // caller cannot use NO_ACCOUNT responses to enumerate registered numbers.
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
      if (!birthDate) {
        logActivity("auth.verify_no_account", { phone, metadata: { channel: "phone" } });
        return noAccountResponse("phone");
      }
      const [created] = await db
        .insert(users)
        .values({
          phone,
          authMethod: "phone",
          isAnonymous: false,
          birthDate,
          ageVerifiedAt: now,
        })
        .returning();
      user = created;
      isNewUser = true;
    } else {
      if (!birthDate && !existing.ageVerifiedAt) {
        logActivity("auth.verify_age_required", { userId: existing.id, phone });
        return ageRequiredResponse();
      }
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
      if (!birthDate) {
        logActivity("auth.verify_no_account", { metadata: { channel: "email", email } });
        return noAccountResponse("email");
      }
      const [created] = await db
        .insert(users)
        .values({
          email,
          authMethod: "email",
          isAnonymous: false,
          birthDate,
          ageVerifiedAt: now,
        })
        .returning();
      user = created;
      isNewUser = true;
    } else {
      if (!birthDate && !existing.ageVerifiedAt) {
        logActivity("auth.verify_age_required", { userId: existing.id, metadata: { email } });
        return ageRequiredResponse();
      }
      const updates: Partial<typeof users.$inferInsert> = {
        isAnonymous: false,
        expiresAt: null,
        authMethod: "email",
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
