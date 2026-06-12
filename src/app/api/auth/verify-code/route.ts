import {
  createAuthToken,
  maskPhone,
  normalizePhone,
  setAuthCookie,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notifyAdminNewUser, notifyAdminReturningUser } from "@/lib/adminNotify";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { getTwilioClient, getVerifyServiceSid } from "@/lib/twilio";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().min(4).max(10),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification request" }, { status: 400 });
  }

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

  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

  let user = existing[0];
  let isNewUser = false;
  if (!user) {
    const [created] = await db.insert(users).values({ phone }).returning();
    user = created;
    isNewUser = true;
  }

  if (isNewUser) {
    notifyAdminNewUser(user.phone);
    logActivity("user.signup", { userId: user.id, phone: user.phone });
  } else {
    notifyAdminReturningUser(user.phone);
    logActivity("user.login", { userId: user.id, phone: user.phone });
  }

  const token = await createAuthToken({ id: user.id, phone: user.phone });
  const response = NextResponse.json({
    user: { id: user.id, phone: user.phone, maskedPhone: maskPhone(user.phone) },
  });
  setAuthCookie(response, token);
  return response;
}