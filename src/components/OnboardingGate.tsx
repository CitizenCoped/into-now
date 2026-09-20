"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthError, type AuthUser } from "@/hooks/useAuth";
import { isAdult } from "@/lib/geo";
import AuthForm from "./AuthForm";
import LandingVideoBackdrop from "./LandingVideoBackdrop";

type Props = {
  user: AuthUser | null;
  loading: boolean;
  onCreateAnonymous: (birthDate: string) => Promise<unknown>;
  onSendPhoneCode: (phone: string) => Promise<string>;
  onSendEmailCode: (email: string) => Promise<string>;
  onVerifyPhoneCode: (phone: string, code: string, birthDate?: string) => Promise<unknown>;
  onVerifyEmailCode: (email: string, code: string, birthDate?: string) => Promise<unknown>;
  children: React.ReactNode;
};

type Step = "birthday" | "mode" | "auth";

const STEP_INDEX: Record<Step, number> = { birthday: 1, mode: 2, auth: 3 };

const STEP_TITLES: Record<Step, string> = {
  birthday: "When is your birthday?",
  mode: "How do you want to join?",
  auth: "Create your free account",
};

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

const ctaClass =
  "w-full rounded-[14px] bg-[#FF2D8A] py-3 font-display italic uppercase text-[16px] leading-none tracking-[.06em] text-[#07060B] shadow-[0_10px_30px_-8px_rgba(255,45,138,.6)] transition hover:shadow-[0_12px_34px_-6px_rgba(255,45,138,.8)] active:scale-[.99] disabled:opacity-45";

function selectClass(chosen: boolean) {
  return `w-full appearance-none rounded-[14px] border bg-[#F5F5F0]/[.06] py-[11px] pl-3 pr-6 text-[14px] text-[#F5F5F0] outline-none transition focus:border-[#00F0FF]/60 ${
    chosen ? "border-[#00F0FF]/50" : "border-[#F5F5F0]/12"
  }`;
}

function Chevron() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#F5F5F0]/40"
    >
      ▾
    </span>
  );
}

function Hero() {
  return (
    <section className="flex flex-none flex-col items-center gap-1.5 px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mark.svg"
        alt=""
        width={52}
        height={56}
        className="mb-1.5 h-14 w-[52px] drop-shadow-[0_4px_18px_rgba(255,45,138,.45)]"
      />
      <h1 className="font-display italic uppercase text-[40px] leading-none tracking-[.04em] text-[#F5F5F0] [text-shadow:0_3px_20px_rgba(0,0,0,.7)]">
        The Best{" "}
        <span className="text-[#FF2D8A] [text-shadow:0_4px_28px_rgba(255,45,138,.45)]">Drug</span>
      </h1>
      <p className="font-display italic uppercase text-[14px] leading-none tracking-[.16em] text-[#FF2D8A] [text-shadow:0_2px_14px_rgba(0,0,0,.6)]">
        Get on <span className="text-[#F5F5F0]">then get</span>{" "}
        <span className="text-[#00F0FF]">off</span>
      </p>
      <p className="mt-0.5 max-w-[280px] text-[12px] leading-[1.4] text-[#F5F5F0]/70 [text-shadow:0_1px_8px_rgba(0,0,0,.7)]">
        See who&apos;s nearby, share what you&apos;re into, and connect in the moment.
      </p>
    </section>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const reached = STEP_INDEX[step];
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-[3px] w-[22px] rounded-[2px] ${
            i <= reached ? "bg-[#FF2D8A]" : "bg-[#F5F5F0]/[.18]"
          }`}
        />
      ))}
    </div>
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
  children,
}: Props) {
  const initialBirth = user?.birthDate ? user.birthDate.slice(0, 10).split("-") : null;
  const [month, setMonth] = useState(initialBirth ? Number(initialBirth[1]) : 0);
  const [day, setDay] = useState(initialBirth ? Number(initialBirth[2]) : 0);
  const [year, setYear] = useState(initialBirth ? Number(initialBirth[0]) : 0);
  const [localStep, setLocalStep] = useState<Step>("birthday");
  // "Already a member? Sign in" goes straight to the auth card and sends no
  // birth date (the account already holds one). The server answers
  // NO_ACCOUNT (unknown contact → sign-up) or AGE_REQUIRED (legacy account
  // that never age-verified → birthday step); the contact is kept so the
  // retry is prefilled.
  const [signInIntent, setSignInIntent] = useState(false);
  const [ageRequired, setAgeRequired] = useState(false);
  const [pendingContact, setPendingContact] = useState<{
    channel: "phone" | "email";
    value: string;
  } | null>(null);
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
    setError("");
  }

  function changeYear(value: number) {
    setYear(value);
    setDay((d) => Math.min(d, daysInMonth(value, month)));
    setError("");
  }

  if (loading) {
    return (
      <main className="relative flex h-dvh items-center justify-center bg-[#07060B] px-4">
        <LandingVideoBackdrop />
        <div className="relative flex flex-col items-center gap-6">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#FF2D8A]" />
          <p className="text-sm text-[#F5F5F0]/40">Loading...</p>
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
      setError("You must be 18 or older to use The Best Drug.");
      return;
    }
    setLocalStep(signInIntent ? "auth" : "mode");
  }

  function handleSignIn() {
    setError("");
    setSignInIntent(true);
    setAgeRequired(false);
    setLocalStep("auth");
  }

  function startSignUp() {
    setError("");
    setSignInIntent(false);
    setAgeRequired(false);
    setLocalStep("birthday");
  }

  // Sign-in omits the birth date unless the server asked for it (AGE_REQUIRED).
  const sendBirthDate = signInIntent && !ageRequired ? undefined : birthDate;

  async function verifyWithRecovery(channel: "phone" | "email", contact: string, code: string) {
    try {
      if (channel === "phone") await onVerifyPhoneCode(contact, code, sendBirthDate);
      else await onVerifyEmailCode(contact, code, sendBirthDate);
    } catch (err) {
      if (err instanceof AuthError && err.code === "NO_ACCOUNT") {
        setPendingContact({ channel, value: contact });
        startSignUp();
        return;
      }
      if (err instanceof AuthError && err.code === "AGE_REQUIRED") {
        setPendingContact({ channel, value: contact });
        setAgeRequired(true);
        setError("");
        setLocalStep("birthday");
        return;
      }
      throw err;
    }
  }

  const birthdayHint = signInIntent
    ? "Confirm your birthday to finish signing in."
    : pendingContact
      ? "No account found for that contact — let’s get you signed up."
      : "You must be 18 or older to join.";

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
    <main className="relative h-dvh w-full overflow-y-auto overflow-x-hidden bg-[#07060B]">
      <LandingVideoBackdrop />

      <div className="relative mx-auto flex w-full max-w-md flex-col pb-10 pt-[170px]">
        <Hero />

        <section className="mt-4 flex-none px-7">
          <div className="rounded-[22px] border border-[#F5F5F0]/10 bg-[#120A14]/45 p-4 pt-3.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,.8)] backdrop-blur-[18px]">
            {!signInIntent && <StepIndicator step={step} />}
            <p className="mt-2 text-center font-display italic uppercase text-[16px] leading-none tracking-[.04em] text-[#F5F5F0]">
              {step === "auth" && signInIntent ? "Sign in" : STEP_TITLES[step]}
            </p>

            {step === "birthday" && (
              <form onSubmit={handleBirthdaySubmit} className="mt-2 flex flex-col gap-2.5">
                <p className="text-center text-[11px] text-[#F5F5F0]/45">{birthdayHint}</p>
                <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-2">
                  <div className="relative">
                    <select
                      aria-label="Birth month"
                      value={month}
                      onChange={(e) => changeMonth(Number(e.target.value))}
                      className={selectClass(month > 0)}
                    >
                      <option value={0} disabled>
                        Month
                      </option>
                      {MONTHS.map((name, i) => (
                        <option key={name} value={i + 1} className="bg-[#120A14]">
                          {name}
                        </option>
                      ))}
                    </select>
                    <Chevron />
                  </div>
                  <div className="relative">
                    <select
                      aria-label="Birth day"
                      value={day}
                      onChange={(e) => {
                        setDay(Number(e.target.value));
                        setError("");
                      }}
                      className={selectClass(day > 0)}
                    >
                      <option value={0} disabled>
                        Day
                      </option>
                      {days.map((d) => (
                        <option key={d} value={d} className="bg-[#120A14]">
                          {d}
                        </option>
                      ))}
                    </select>
                    <Chevron />
                  </div>
                  <div className="relative">
                    <select
                      aria-label="Birth year"
                      value={year}
                      onChange={(e) => changeYear(Number(e.target.value))}
                      className={selectClass(year > 0)}
                    >
                      <option value={0} disabled>
                        Year
                      </option>
                      {years.map((y) => (
                        <option key={y} value={y} className="bg-[#120A14]">
                          {y}
                        </option>
                      ))}
                    </select>
                    <Chevron />
                  </div>
                </div>
                {error && <p className="text-[13px] text-[#FF2D8A]">{error}</p>}
                <button type="submit" disabled={!birthDate} className={ctaClass}>
                  Continue
                </button>
              </form>
            )}

            {step === "mode" && (
              <div className="mt-[18px] flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setLocalStep("auth")}
                  className="flex w-full items-center justify-between gap-3 rounded-[14px] border border-[#FF2D8A]/45 bg-[#FF2D8A]/[.12] px-4 py-3.5 text-left transition hover:bg-[#FF2D8A]/20"
                >
                  <span>
                    <span className="block font-display italic uppercase text-[17px] leading-none tracking-[.04em] text-[#FF2D8A]">
                      Sign up free
                    </span>
                    <span className="mt-1 block text-[12px] text-[#F5F5F0]/55">
                      Verify with phone or email
                    </span>
                  </span>
                  <span className="text-[18px] text-[#FF2D8A]">→</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleAnonymous()}
                  disabled={submitting}
                  className="flex w-full items-center justify-between gap-3 rounded-[14px] border border-[#F5F5F0]/12 bg-[#F5F5F0]/5 px-4 py-3.5 text-left transition hover:bg-[#F5F5F0]/10 disabled:opacity-50"
                >
                  <span>
                    <span className="block font-display italic uppercase text-[17px] leading-none tracking-[.04em] text-[#F5F5F0]">
                      Stay anonymous
                    </span>
                    <span className="mt-1 block text-[12px] text-[#F5F5F0]/55">
                      4-hour session, no account needed
                    </span>
                  </span>
                  <span className="text-[18px] text-[#00F0FF]">→</span>
                </button>
                {error && <p className="text-[13px] text-[#FF2D8A]">{error}</p>}
                <button
                  type="button"
                  onClick={() => setLocalStep("birthday")}
                  className="mt-0.5 text-[12px] text-[#F5F5F0]/45 transition hover:text-[#F5F5F0]"
                >
                  ← Back
                </button>
              </div>
            )}

            {step === "auth" && (
              <div className="mt-4">
                <AuthForm
                  key={signInIntent ? "signin" : "signup"}
                  mode={signInIntent ? "signin" : "signup"}
                  initialChannel={pendingContact?.channel}
                  initialPhone={pendingContact?.channel === "phone" ? pendingContact.value : undefined}
                  initialEmail={pendingContact?.channel === "email" ? pendingContact.value : undefined}
                  onSendPhoneCode={onSendPhoneCode}
                  onSendEmailCode={onSendEmailCode}
                  onVerifyPhoneCode={(phone, code) => verifyWithRecovery("phone", phone, code)}
                  onVerifyEmailCode={(email, code) => verifyWithRecovery("email", email, code)}
                  onBack={() => {
                    const wasSignIn = signInIntent;
                    setSignInIntent(false);
                    setAgeRequired(false);
                    setLocalStep(wasSignIn ? "birthday" : "mode");
                  }}
                />
              </div>
            )}
          </div>

          <p className="mt-2.5 text-center text-[10px] uppercase leading-[1.9] tracking-[.14em] text-[#F5F5F0]/40">
            18+ only ·{" "}
            <Link href="/policies/terms-of-service" className="text-[#F5F5F0]/55 transition hover:text-[#F5F5F0]">
              Terms
            </Link>{" "}
            ·{" "}
            <Link href="/policies/take-it-down" className="text-[#F5F5F0]/55 transition hover:text-[#F5F5F0]">
              Report content
            </Link>{" "}
            · thebestdrug.com
          </p>
          {step !== "auth" ? (
            <p className="mt-2 text-center text-[12px] text-[#F5F5F0]/60">
              Already a member?{" "}
              <button
                type="button"
                onClick={handleSignIn}
                className="font-semibold text-[#00F0FF] transition hover:text-[#7DF9FF]"
              >
                Sign in
              </button>
            </p>
          ) : signInIntent ? (
            <p className="mt-2 text-center text-[12px] text-[#F5F5F0]/60">
              New here?{" "}
              <button
                type="button"
                onClick={startSignUp}
                className="font-semibold text-[#00F0FF] transition hover:text-[#7DF9FF]"
              >
                Sign up
              </button>
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
