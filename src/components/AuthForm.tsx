"use client";

import { useState } from "react";

type Props = {
  onSendPhoneCode: (phone: string) => Promise<string>;
  onSendEmailCode: (email: string) => Promise<string>;
  onVerifyPhoneCode: (phone: string, code: string) => Promise<unknown>;
  onVerifyEmailCode: (email: string, code: string) => Promise<unknown>;
  /** Rendered as "← Back" in the footer row when provided (landing card). */
  onBack?: () => void;
  /** "signin" only changes copy; the parent decides whether a birth date is sent. */
  mode?: "signup" | "signin";
  initialChannel?: "phone" | "email";
  initialPhone?: string;
  initialEmail?: string;
};

const inputClass =
  "w-full rounded-[12px] border border-[#F5F5F0]/12 bg-[#F5F5F0]/[.06] px-3 py-[11px] text-[14px] text-[#F5F5F0] placeholder:text-[#F5F5F0]/35 outline-none transition focus:border-[#00F0FF]/60";

const ctaClass =
  "w-full rounded-[14px] bg-[#FF2D8A] py-3 font-display italic uppercase text-[16px] leading-none tracking-[.06em] text-[#07060B] shadow-[0_10px_30px_-8px_rgba(255,45,138,.6)] transition hover:shadow-[0_12px_34px_-6px_rgba(255,45,138,.8)] active:scale-[.99] disabled:opacity-45";

export default function AuthForm({
  onSendPhoneCode,
  onSendEmailCode,
  onVerifyPhoneCode,
  onVerifyEmailCode,
  onBack,
  mode = "signup",
  initialChannel = "phone",
  initialPhone = "",
  initialEmail = "",
}: Props) {
  const [channel, setChannel] = useState<"phone" | "email">(initialChannel);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [normalizedEmail, setNormalizedEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"input" | "code">("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function pickChannel(next: "phone" | "email") {
    setChannel(next);
    setStep("input");
    setCode("");
    setError("");
  }

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Phone / Email segmented control */}
      <div className="flex gap-1.5 rounded-xl bg-[#F5F5F0]/[.06] p-1">
        {(["phone", "email"] as const).map((option) => {
          const active = channel === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => pickChannel(option)}
              className={`flex-1 rounded-[9px] py-2 text-[13px] font-semibold transition ${
                active ? "bg-[#FF2D8A] text-[#07060B]" : "text-[#F5F5F0]/60 hover:text-[#F5F5F0]"
              }`}
            >
              {option === "phone" ? "Phone" : "Email"}
            </button>
          );
        })}
      </div>

      {step === "input" ? (
        <form onSubmit={handleSendCode} className="space-y-3">
          {channel === "phone" ? (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className={inputClass}
              autoComplete="tel"
            />
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
              autoComplete="email"
            />
          )}
          <button
            type="submit"
            disabled={loading || (channel === "phone" ? !phone.trim() : !email.trim())}
            className={ctaClass}
          >
            {loading ? "Sending..." : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <p className="text-[12px] text-[#F5F5F0]/50">
            Code sent to <span className="text-[#00F0FF]">{destination}</span>
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full rounded-[14px] border border-[#F5F5F0]/12 bg-[#F5F5F0]/[.06] px-3 py-3.5 text-center text-[22px] tracking-[.3em] text-[#F5F5F0] placeholder:text-[#F5F5F0]/35 placeholder:tracking-normal outline-none transition focus:border-[#00F0FF]/60"
            autoComplete="one-time-code"
          />
          <button type="submit" disabled={loading || code.trim().length < 4} className={ctaClass}>
            {loading ? "Verifying..." : "Verify & get on"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("input");
              setCode("");
              setError("");
            }}
            className="w-full text-[12px] text-[#F5F5F0]/45 transition hover:text-[#F5F5F0]"
          >
            Use a different {channel === "phone" ? "number" : "email"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-[#FF2D8A]">{error}</p>}

      <div className="mt-auto flex items-center justify-between pt-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-[12px] text-[#F5F5F0]/45 transition hover:text-[#F5F5F0]"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-[11px] text-[#F5F5F0]/35">
          {mode === "signin" ? "Welcome back · 24-hour sessions" : "Free account · 24-hour sessions"}
        </span>
      </div>
    </div>
  );
}
