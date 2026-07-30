"use client";

import { useCallback, useEffect, useState } from "react";

type ActivityRow = {
  id: string;
  action: string;
  userId: string | null;
  phone: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  "auth.code_sent": "Code sent",
  "auth.code_failed": "Code send failed",
  "auth.verify_failed": "Verify failed",
  "user.signup": "New signup",
  "user.login": "Login",
  "user.logout": "Logout",
  "post.created": "Post created",
  "conversation.started": "Conversation started",
  "message.sent": "Message sent",
  "presence.online": "Went live",
  "presence.offline": "Went offline",
  "push.subscribed": "Push subscribed",
  "push.unsubscribed": "Push unsubscribed",
  "push.preferences_updated": "Push prefs updated",
  "assist.requested": "Grok assist",
};

function formatAction(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function formatMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) return "—";
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [inputSecret, setInputSecret] = useState("");
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("intonow_admin_secret");
    if (stored) setSecret(stored);
  }, []);

  const fetchActivities = useCallback(async (adminSecret: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/activity?limit=200", {
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load activity");
      setActivities(data.activities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!secret) return;
    void fetchActivities(secret);
    const interval = window.setInterval(() => {
      void fetchActivities(secret);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [secret, fetchActivities]);

  function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = inputSecret.trim();
    if (!trimmed) return;
    sessionStorage.setItem("intonow_admin_secret", trimmed);
    setSecret(trimmed);
    setInputSecret("");
  }

  function handleLogout() {
    sessionStorage.removeItem("intonow_admin_secret");
    setSecret("");
    setActivities([]);
  }

  if (!secret) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-xl font-semibold text-white">into.now activity</h1>
        <p className="mt-2 text-sm text-white/50">
          Enter your admin secret to view what users are doing.
        </p>
        <form onSubmit={handleUnlock} className="mt-6 space-y-3">
          <input
            type="password"
            value={inputSecret}
            onChange={(e) => setInputSecret(e.target.value)}
            placeholder="Admin secret"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#FF4D6D]/50"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-[#FF4D6D] px-3 py-2 text-sm font-medium text-white"
          >
            View activity
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Activity feed</h1>
          <p className="mt-1 text-sm text-white/50">
            Auto-refreshes every 30s · {activities.length} events
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchActivities(secret)}
            disabled={loading}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:text-white"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:text-white"
          >
            Lock
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/40">
                  {loading ? "Loading activity…" : "No activity yet."}
                </td>
              </tr>
            ) : (
              activities.map((row) => (
                <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-4 py-3 text-white/60">
                    {formatTime(row.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                    {formatAction(row.action)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#ff8a1e]">
                    {row.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-white/50">{formatMetadata(row.metadata)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}