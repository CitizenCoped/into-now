import { normalizePhone } from "@/lib/auth";
import { getTwilioClient, getVerifyServiceSid } from "@/lib/twilio";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  phone: z.string().min(7).max(20),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

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

    return NextResponse.json({ ok: true, phone });
  } catch (error) {
    console.error("Twilio send-code error:", error);
    return NextResponse.json(
      { error: "Could not send verification code. Check your number and try again." },
      { status: 502 }
    );
  }
}