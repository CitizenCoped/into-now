import { Resend } from "resend";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return new Resend(apiKey);
}

function getFromAddress() {
  const from = process.env.RESEND_FROM;
  if (!from) throw new Error("RESEND_FROM is not set");
  return from;
}

export async function sendEmailCode(email: string, code: string) {
  const resend = getResend();
  const from = getFromAddress();

  await resend.emails.send({
    from,
    to: email,
    subject: "Your Into Now verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
}