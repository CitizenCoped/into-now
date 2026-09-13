"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Dashboard = {
  pendingCount: number;
  sightengineConfigured: boolean;
  last24h: {
    autoApproved: number;
    autoRejected: number;
    allowed: number;
    upheld: number;
  };
};

export default function ManagementDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/management/dashboard")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
      <p className="mt-1 text-sm text-white/50">
        Photo moderation is the first surface. Sightengine queues borderline photos for a human.
      </p>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      {data ? (
        <div className="mt-6 space-y-4">
          {data.pendingCount > 0 ? (
            <Link
              href="/management/moderation"
              className="block rounded-2xl border border-[#FF4D6D]/40 bg-[#FF4D6D]/10 px-4 py-4"
            >
              <p className="text-sm font-medium text-[#FF4D6D]">Photo rejections waiting</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {data.pendingCount} photo{data.pendingCount === 1 ? "" : "s"} to review
              </p>
              <p className="mt-1 text-xs text-white/50">Open the queue — allow or keep rejected.</p>
            </Link>
          ) : (
            <div className="rounded-2xl border border-white/10 px-4 py-4">
              <p className="text-sm font-medium text-white">Review queue is clear</p>
              <p className="mt-1 text-xs text-white/50">No photos are waiting on a human decision.</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Auto-approved", data.last24h.autoApproved],
              ["Held for review", data.last24h.autoRejected],
              ["You allowed", data.last24h.allowed],
              ["You upheld", data.last24h.upheld],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/10 px-3 py-3">
                <p className="text-xs text-white/40">{label}</p>
                <p className="mt-1 text-xl font-semibold text-white">{value}</p>
                <p className="text-[11px] text-white/30">last 24h</p>
              </div>
            ))}
          </div>

          <p className={`text-xs ${data.sightengineConfigured ? "text-emerald-300/80" : "text-[#ff8a1e]"}`}>
            Sightengine {data.sightengineConfigured ? "is configured" : "is not configured — uploads pass unscanned"}
          </p>
        </div>
      ) : !error ? (
        <p className="mt-6 text-sm text-white/40">Loading…</p>
      ) : null}
    </div>
  );
}
