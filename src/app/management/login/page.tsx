"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/management";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/management/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pendingToken ? { pendingToken, totp } : { username, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      if (data.challenge === "totp") {
        setPendingToken(data.pendingToken);
        return;
      }
      router.replace(next.startsWith("/management") ? next : "/management");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-white">Management</h1>
      <p className="mt-2 text-sm text-white/50">
        {pendingToken
          ? "Enter the 6-digit code from Google Authenticator."
          : "Username, password, then authenticator code."}
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
        {!pendingToken ? (
          <>
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#FF4D6D]/50"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#FF4D6D]/50"
            />
          </>
        ) : (
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            placeholder="123456"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm tracking-widest text-white outline-none focus:border-[#FF4D6D]/50"
          />
        )}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[#FF4D6D] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Checking…" : pendingToken ? "Verify" : "Continue"}
        </button>
      </form>
    </main>
  );
}

export default function ManagementLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
