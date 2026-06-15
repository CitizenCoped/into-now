import { logActivity } from "@/lib/activity";
import { normalizeEmail, normalizePhone } from "@/lib/auth";
import { generateCode, storeAuthCode } from "@/lib/authCodes";
import { sendEmailCode } from "@/lib/resend";
import { getTwilioClient, getVerifyServiceSid } from "@/lib/twilio";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("phone"),
    phone: z.string().min(7).max(20),
  }),
  z.object({
    channel: z.literal("email"),
    email: z.string().email(),
  }),
]);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification request" }, { status: 400 });
  }

  if (parsed.data.channel === "phone") {
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
    }

    try {
      const client = getTwilioClient();
      const serviceSid = getVerifyServiceSid();

      await client.verify.v2.services(serviceSid).verifications.create({
        to: phone,
        channel: "sms",
      });

      logActivity("auth.code_sent", { phone, metadata: { channel: "phone" } });
      return NextResponse.json({ ok: true, channel: "phone", phone });
    } catch (error) {
      console.error("Twilio send-code error:", error);
      logActivity("auth.code_failed", { phone, metadata: { reason: "twilio_error" } });
      return NextResponse.json(
        { error: "Could not send verification code. Check your number and try again." },
        { status: 502 }
      );
    }
  }

  const email = normalizeEmail(parsed.data.email);
  if (!email) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  try {
    const code = generateCode();
    await storeAuthCode("email", email, code);
    await sendEmailCode(email, code);
    logActivity("auth.code_sent", { metadata: { channel: "email", email } });
    return NextResponse.json({ ok: true, channel: "email", email });
  } catch (error) {
    console.error("Resend send-code error:", error);
    logActivity("auth.code_failed", { metadata: { channel: "email", email, reason: "resend_error" } });
    return NextResponse.json(
      { error: "Could not send verification code. Try again shortly." },
      { status: 502 }
    );
  }
}