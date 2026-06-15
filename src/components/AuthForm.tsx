"use client";

import { useState } from "react";

type Props = {
  birthDate: string;
  onSendPhoneCode: (phone: string) => Promise<string>;
  onSendEmailCode: (email: string) => Promise<string>;
  onVerifyPhoneCode: (phone: string, code: string) => Promise<unknown>;
  onVerifyEmailCode: (email: string, code: string) => Promise<unknown>;
};

export default function AuthForm({
  birthDate,
  onSendPhoneCode,
  onSendEmailCode,
  onVerifyPhoneCode,
  onVerifyEmailCode,
}: Props) {
  const [channel, setChannel] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [normalizedEmail, setNormalizedEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"input" | "code">("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (channel === "phone") {
        const sentTo = await onSendPhoneCode(phone);
        setNormalizedPhone(sentTo);
      } else {
        const sentTo = await onSendEmailCode(email);
        setNormalizedEmail(sentTo);
      }
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (channel === "phone") {
        await onVerifyPhoneCode(normalizedPhone, code);
      } else {
        await onVerifyEmailCode(normalizedEmail, code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  const destination = channel === "phone" ? normalizedPhone : normalizedEmail;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setChannel("phone");
            setStep("input");
            setCode("");
            setError("");
          }}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
            channel === "phone"
              ? "border-[#22D3EE]/40 bg-[#22D3EE]/10 text-[#22D3EE]"
              : "border-white/10 text-white/50"
          }`}
        >
          Phone
        </button>
        <button
          type="button"
          onClick={() => {
            setChannel("email");
            setStep("input");
            setCode("");
            setError("");
          }}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
            channel === "email"
              ? "border-[#22D3EE]/40 bg-[#22D3EE]/10 text-[#22D3EE]"
              : "border-white/10 text-white/50"
          }`}
        >
          Email
        </button>
      </div>

      {step === "input" ? (
        <form onSubmit={handleSendCode} className="space-y-3">
          {channel === "phone" ? (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#22D3EE]/50"
              autoComplete="tel"
            />
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#22D3EE]/50"
              autoComplete="email"
            />
          )}
          <button
            type="submit"
            disabled={loading || (channel === "phone" ? !phone.trim() : !email.trim())}
            className="w-full rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#38BDF8] py-2.5 text-sm font-semibold text-[#06040c] transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <p className="text-xs text-white/40">Code sent to {destination}</p>
          <input type="hidden" value={birthDate} readOnly />
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#22D3EE]/50"
            autoComplete="one-time-code"
          />
          <button
            type="submit"
            disabled={loading || code.trim().length < 4}
            className="w-full rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#38BDF8] py-2.5 text-sm font-semibold text-[#06040c] transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify & sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("input");
              setCode("");
              setError("");
            }}
            className="w-full text-xs text-white/40 transition hover:text-white/70"
          >
            Use a different {channel === "phone" ? "number" : "email"}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-[#FF4D6D]">{error}</p>}
      <p className="mt-auto pt-4 text-[11px] text-white/30">
        Free account — sessions last 24 hours.
      </p>
    </div>
  );
}