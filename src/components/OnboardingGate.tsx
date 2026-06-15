"use client";

import { useState } from "react";
import type { AuthUser } from "@/hooks/useAuth";
import AuthForm from "./AuthForm";
import ProfileEditor from "./ProfileEditor";

type Props = {
  user: AuthUser | null;
  loading: boolean;
  onCreateAnonymous: (birthDate: string) => Promise<void>;
  onSendPhoneCode: (phone: string) => Promise<string>;
  onSendEmailCode: (email: string) => Promise<string>;
  onVerifyPhoneCode: (phone: string, code: string, birthDate: string) => Promise<unknown>;
  onVerifyEmailCode: (email: string, code: string, birthDate: string) => Promise<unknown>;
  onSaveProfile: (updates: { displayName: string; statement: string; photoUrl: string }) => Promise<unknown>;
  children: React.ReactNode;
};

type Step = "birthday" | "mode" | "auth" | "profile" | "ready";

function isAdult(birthDate: string) {
  const born = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 18;
}

export default function OnboardingGate({
  user,
  loading,
  onCreateAnonymous,
  onSendPhoneCode,
  onSendEmailCode,
  onVerifyPhoneCode,
  onVerifyEmailCode,
  onSaveProfile,
  children,
}: Props) {
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? "");
  const [birthdayConfirmed, setBirthdayConfirmed] = useState(Boolean(user?.birthDate));
  const [localStep, setLocalStep] = useState<"auth" | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#06040c] text-white/50">
        Loading...
      </main>
    );
  }

  if (user?.ageVerifiedAt && user.profileComplete) {
    return <>{children}</>;
  }

  let step: Step = "birthday";
  if (user?.ageVerifiedAt && !user.profileComplete) step = "profile";
  else if (localStep === "auth") step = "auth";
  else if (birthdayConfirmed && birthDate && isAdult(birthDate) && !user) step = "mode";

  async function handleBirthdaySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isAdult(birthDate)) {
      setError("You must be 18 or older to use Into Now.");
      return;
    }
    setBirthdayConfirmed(true);
  }

  async function handleAnonymous() {
    setSubmitting(true);
    setError("");
    try {
      await onCreateAnonymous(birthDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06040c] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0d18]/90 p-6 shadow-2xl backdrop-blur-xl">
        <h1 className="text-center text-xl font-semibold text-white">Into Now</h1>
        <p className="mt-2 text-center text-sm text-white/50">
          {step === "birthday" && "When is your birthday?"}
          {step === "mode" && "How do you want to join?"}
          {step === "auth" && "Create your free account"}
          {step === "profile" && "Set up your profile"}
        </p>

        {step === "birthday" && (
          <form onSubmit={handleBirthdaySubmit} className="mt-6 space-y-4">
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#22D3EE]/50"
              required
            />
            {error && <p className="text-sm text-[#FF4D6D]">{error}</p>}
            <button
              type="submit"
              disabled={!birthDate}
              className="w-full rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#38BDF8] py-2.5 text-sm font-semibold text-[#06040c] disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        )}

        {step === "mode" && (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => setLocalStep("auth")}
              className="w-full rounded-lg border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-4 py-3 text-left transition hover:bg-[#22D3EE]/20"
            >
              <p className="font-semibold text-[#22D3EE]">Sign up free</p>
              <p className="mt-1 text-xs text-white/50">Verify with phone or email</p>
            </button>
            <button
              type="button"
              onClick={() => void handleAnonymous()}
              disabled={submitting}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 disabled:opacity-50"
            >
              <p className="font-semibold text-white">Stay anonymous</p>
              <p className="mt-1 text-xs text-white/50">4-hour session, no account needed</p>
            </button>
            {error && <p className="text-sm text-[#FF4D6D]">{error}</p>}
          </div>
        )}

        {step === "auth" && (
          <div className="mt-4">
            <AuthForm
              birthDate={birthDate}
              onSendPhoneCode={onSendPhoneCode}
              onSendEmailCode={onSendEmailCode}
              onVerifyPhoneCode={(phone, code) => onVerifyPhoneCode(phone, code, birthDate)}
              onVerifyEmailCode={(email, code) => onVerifyEmailCode(email, code, birthDate)}
            />
          </div>
        )}

        {step === "profile" && user && (
          <ProfileEditor user={user} onSave={onSaveProfile} />
        )}
      </div>
    </main>
  );
}