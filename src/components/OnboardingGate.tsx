"use client";

import { useState } from "react";
import type { AuthUser } from "@/hooks/useAuth";
import { isAdult } from "@/lib/geo";
import AuthForm from "./AuthForm";
import LandingVideoBackdrop from "./LandingVideoBackdrop";

type Props = {
  user: AuthUser | null;
  loading: boolean;
  onCreateAnonymous: (birthDate: string) => Promise<unknown>;
  onSendPhoneCode: (phone: string) => Promise<string>;
  onSendEmailCode: (email: string) => Promise<string>;
  onVerifyPhoneCode: (phone: string, code: string, birthDate: string) => Promise<unknown>;
  onVerifyEmailCode: (email: string, code: string, birthDate: string) => Promise<unknown>;
  children: React.ReactNode;
};

type Step = "birthday" | "mode" | "auth";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(year: number, month: number) {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function OnboardingBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-1/3 top-0 h-[55vh] w-[70vw] rounded-full bg-[#FF8A1E]/10 blur-[120px]" />
      <div className="absolute -right-1/4 bottom-0 h-[45vh] w-[55vw] rounded-full bg-[#FFB03A]/8 blur-[100px]" />
    </div>
  );
}

function OnboardingHero() {
  return (
    <section className="w-full text-center">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FF8A1E]/90">
        into.now
      </p>
      <h1 className="mb-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
        What are you into?
        <span className="block text-[#FF8A1E]">Right now.</span>
      </h1>
      <p className="text-sm leading-relaxed text-white/60">
        See who&apos;s nearby, share what you&apos;re into, and connect in the moment.
      </p>
    </section>
  );
}

const selectClass =
  "w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-3.5 text-base text-white outline-none transition focus:border-[#FF8A1E]/60 focus:bg-white/10";

export default function OnboardingGate({
  user,
  loading,
  onCreateAnonymous,
  onSendPhoneCode,
  onSendEmailCode,
  onVerifyPhoneCode,
  onVerifyEmailCode,
  children,
}: Props) {
  const initialBirth = user?.birthDate ? user.birthDate.slice(0, 10).split("-") : null;
  const [month, setMonth] = useState(initialBirth ? Number(initialBirth[1]) : 0);
  const [day, setDay] = useState(initialBirth ? Number(initialBirth[2]) : 0);
  const [year, setYear] = useState(initialBirth ? Number(initialBirth[0]) : 0);
  const [localStep, setLocalStep] = useState<Step>("birthday");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 18; y >= currentYear - 100; y -= 1) years.push(y);

  const dayCount = daysInMonth(year, month);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  const birthDate = month && day && year ? `${year}-${pad(month)}-${pad(day)}` : "";

  function changeMonth(value: number) {
    setMonth(value);
    setDay((d) => Math.min(d, daysInMonth(year, value)));
  }

  function changeYear(value: number) {
    setYear(value);
    setDay((d) => Math.min(d, daysInMonth(value, month)));
  }

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[#06040c] px-4">
        <LandingVideoBackdrop />
        <OnboardingBackdrop />
        <div className="relative flex flex-col items-center gap-6">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#FF8A1E]" />
          <p className="text-sm text-white/40">Loading...</p>
        </div>
      </main>
    );
  }

  if (user?.ageVerifiedAt) {
    return <>{children}</>;
  }

  const step = localStep;

  function handleBirthdaySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!birthDate) {
      setError("Please select your full birthday.");
      return;
    }
    if (!isAdult(birthDate)) {
      setError("You must be 18 or older to use Into Now.");
      return;
    }
    setLocalStep("mode");
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
      <LandingVideoBackdrop />
      <OnboardingBackdrop />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 px-4 py-8 sm:px-6">
        <OnboardingHero />

        <section className="w-full shrink-0">
          <div className="rounded-2xl border border-white/10 bg-[#0f0d18]/60 p-6 shadow-2xl backdrop-blur-xl">
            <p className="text-center text-sm font-medium text-white/70">
              {step === "birthday" && "When is your birthday?"}
              {step === "mode" && "How do you want to join?"}
              {step === "auth" && "Create your free account"}
            </p>

            {step === "birthday" && (
              <form onSubmit={handleBirthdaySubmit} className="mt-6 space-y-4">
                <p className="text-center text-xs text-white/40">
                  You must be 18 or older to join.
                </p>
                <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-2">
                  <select
                    aria-label="Birth month"
                    value={month}
                    onChange={(e) => changeMonth(Number(e.target.value))}
                    className={selectClass}
                  >
                    <option value={0} disabled>
                      Month
                    </option>
                    {MONTHS.map((name, i) => (
                      <option key={name} value={i + 1} className="bg-[#0f0d18]">
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Birth day"
                    value={day}
                    onChange={(e) => setDay(Number(e.target.value))}
                    className={selectClass}
                  >
                    <option value={0} disabled>
                      Day
                    </option>
                    {days.map((d) => (
                      <option key={d} value={d} className="bg-[#0f0d18]">
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Birth year"
                    value={year}
                    onChange={(e) => changeYear(Number(e.target.value))}
                    className={selectClass}
                  >
                    <option value={0} disabled>
                      Year
                    </option>
                    {years.map((y) => (
                      <option key={y} value={y} className="bg-[#0f0d18]">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                {error && <p className="text-sm text-[#FF4D6D]">{error}</p>}
                <button
                  type="submit"
                  disabled={!birthDate}
                  className="w-full rounded-xl bg-gradient-to-r from-[#FFB03A] to-[#F56A00] py-3.5 text-base font-semibold text-[#06040c] transition active:scale-[0.99] disabled:opacity-50"
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
                  className="w-full rounded-lg border border-[#FF8A1E]/30 bg-[#FF8A1E]/10 px-4 py-3 text-left transition hover:bg-[#FF8A1E]/20"
                >
                  <p className="font-semibold text-[#FF8A1E]">Sign up free</p>
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
          </div>
        </section>
      </div>
    </main>
  );
}
