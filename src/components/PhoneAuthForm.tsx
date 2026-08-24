"use client";

import { useState } from "react";

type Props = {
  onSendCode: (phone: string) => Promise<string>;
  onVerifyCode: (phone: string, code: string) => Promise<void>;
};

export default function PhoneAuthForm({ onSendCode, onVerifyCode }: Props) {
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const sentTo = await onSendCode(phone);
      setNormalizedPhone(sentTo);
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
      await onVerifyCode(normalizedPhone, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-4 text-sm text-white/60">
        Sign in with your phone number to message people nearby.
      </p>

      {step === "phone" ? (
        <form onSubmit={handleSendCode} className="space-y-3">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF8A1E]/50"
            autoComplete="tel"
          />
          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="w-full rounded-lg bg-gradient-to-r from-[#FFB03A] to-[#F56A00] py-2.5 text-sm font-semibold text-[#06040c] transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <p className="text-xs text-white/40">Code sent to {normalizedPhone}</p>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF8A1E]/50"
            autoComplete="one-time-code"
          />
          <button
            type="submit"
            disabled={loading || code.trim().length < 4}
            className="w-full rounded-lg bg-gradient-to-r from-[#FFB03A] to-[#F56A00] py-2.5 text-sm font-semibold text-[#06040c] transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify & sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError("");
            }}
            className="w-full text-xs text-white/40 transition hover:text-white/70"
          >
            Use a different number
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-[#FF4D6D]">{error}</p>}
      <p className="mt-auto pt-4 text-[11px] text-white/30">
        Sessions last 24 hours, then you sign in again.
      </p>
    </div>
  );
}