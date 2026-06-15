"use client";

import { useState } from "react";
import type { AuthUser } from "@/hooks/useAuth";
import AuthForm from "./AuthForm";
import IntroVideo from "./IntroVideo";
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

function OnboardingBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-1/3 top-0 h-[55vh] w-[70vw] rounded-full bg-[#22D3EE]/10 blur-[120px]" />
      <div className="absolute -right-1/4 bottom-0 h-[45vh] w-[55vw] rounded-full bg-[#38BDF8]/8 blur-[100px]" />
      <div className="absolute left-1/2 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

function OnboardingHero() {
  return (
    <section className="w-full flex-1 lg:max-w-xl">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-[#22D3EE]/90 lg:text-left">
        into.now
      </p>
      <h1 className="mb-4 text-center text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-left">
        What are you into?
        <span className="block text-[#22D3EE]">Right now.</span>
      </h1>
      <IntroVideo />
      <p className="mt-4 text-center text-sm leading-relaxed text-white/45 lg:text-left">
        See who&apos;s nearby, share what you&apos;re into, and connect in the moment.
      </p>
    </section>
  );
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
      <main className="relative flex min-h-screen items-center justify-center bg-[#06040c] px-4">
        <OnboardingBackdrop />
        <div className="relative flex flex-col items-center gap-6">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#22D3EE]" />
          <p className="text-sm text-white/40">Loading...</p>
        </div>
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
    <main className="relative min-h-screen overflow-x-hidden bg-[#06040c]">
      <OnboardingBackdrop />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:gap-14 lg:px-8 lg:py-12">
        <OnboardingHero />

        <section className="w-full max-w-md shrink-0">
          <div className="rounded-2xl border border-white/10 bg-[#0f0d18]/90 p-6 shadow-2xl backdrop-blur-xl">
            <p className="text-center text-sm font-medium text-white/70">
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
              <div className="mt-4">
                <ProfileEditor user={user} onSave={onSaveProfile} />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}