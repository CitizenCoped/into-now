"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

function SetupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const missing = !token;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totp, setTotp] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stage = qr ? "totp" : "account";

  const canSubmitAccount = useMemo(
    () => username.trim().length >= 3 && password.length >= 10 && password === confirm,
    [username, password, confirm]
  );

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmitAccount) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/management/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Setup failed");
      setQr(data.qrDataUrl);
      setOtpauth(data.otpauth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmTotp(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/management/setup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, totp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      router.replace("/management");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6">
        <h1 className="text-xl font-semibold text-white">Invite not found</h1>
        <p className="mt-2 text-sm text-white/50">This setup link is missing, expired, or already used.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-white">Create admin account</h1>
      <p className="mt-2 text-sm text-white/50">
        {stage === "account"
          ? "Choose a username and password. Next you’ll scan a QR code in Google Authenticator."
          : "Scan the QR code, then enter the first 6-digit code to finish."}
      </p>

      {stage === "account" ? (
        <form onSubmit={(e) => void createAccount(e)} className="mt-6 space-y-3">
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#FF2D8A]/50"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (10+ characters)"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#FF2D8A]/50"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#FF2D8A]/50"
          />
          {password && confirm && password !== confirm ? (
            <p className="text-xs text-red-300">Passwords do not match.</p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !canSubmitAccount}
            className="w-full rounded-lg bg-[#FF2D8A] px-3 py-2 text-sm font-medium text-[#07060B] disabled:opacity-60"
          >
            {busy ? "Creating…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void confirmTotp(e)} className="mt-6 space-y-4">
          {qr ? (
            <img
              src={qr}
              alt="Authenticator QR code"
              className="mx-auto rounded-xl bg-white p-2"
              width={240}
              height={240}
            />
          ) : null}
          {otpauth ? (
            <p className="break-all text-center text-[11px] text-white/40">{otpauth}</p>
          ) : null}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            placeholder="123456"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm tracking-widest text-white outline-none focus:border-[#FF2D8A]/50"
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || totp.replace(/\s/g, "").length !== 6}
            className="w-full rounded-lg bg-[#FF2D8A] px-3 py-2 text-sm font-medium text-[#07060B] disabled:opacity-60"
          >
            {busy ? "Verifying…" : "Activate account"}
          </button>
        </form>
      )}
    </main>
  );
}

export default function ManagementSetupPage() {
  return (
    <Suspense>
      <SetupForm />
    </Suspense>
  );
}
