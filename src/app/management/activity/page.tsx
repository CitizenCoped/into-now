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
  "photo.approved": "Photo auto-approved",
  "photo.rejected": "Photo held for review",
  "photo.deleted": "Photo deleted",
  "photo.hidden": "Photo hidden",
  "photo.unhidden": "Photo unhidden",
  "photo.revealed": "Photo revealed",
  "admin.login": "Admin login",
  "admin.logout": "Admin logout",
  "admin.signup": "Admin created",
  "admin.photo_allowed": "Admin allowed photo",
  "admin.photo_upheld": "Admin kept rejection",
  "admin.moderation_settings_updated": "Sensitivity updated",
  "admin.moderation_apply_pending": "Applied sensitivity to queue",
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

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/management/activity?limit=200");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load activity");
      setActivities(data.activities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Activity</h1>
          <p className="mt-1 text-sm text-white/50">
            Auto-refreshes every 30s · {activities.length} events
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:text-white"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
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
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                    {formatAction(row.action)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#ff8a1e]">{row.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-white/50">{formatMetadata(row.metadata)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
