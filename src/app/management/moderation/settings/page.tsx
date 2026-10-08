"use client";

import {
  CLASS_CATALOG,
  DEFAULT_MODERATION_SETTINGS,
  type ModerationSettingsMap,
  type ModerationSurface,
} from "@/lib/moderationCatalog";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Replay = {
  sampleSize: number;
  pendingWouldAllow: number;
  pendingStay: number;
  historicalWouldQueue: number;
  historicalStayAllow: number;
};

const SURFACES: { id: ModerationSurface; label: string; blurb: string }[] = [
  {
    id: "dm",
    label: "DM photos",
    blurb: "Photos in a user’s private “My photos” library, shared one-to-one with blur-to-reveal.",
  },
  {
    id: "posts",
    label: "Posts (photos + video)",
    blurb: "Media attached to public posts — visible to everyone nearby. Videos score by their worst frame.",
  },
];

function Sensitivity() {
  const search = useSearchParams();
  const surface: ModerationSurface = search.get("surface") === "posts" ? "posts" : "dm";
  const [settings, setSettings] = useState<ModerationSettingsMap>(DEFAULT_MODERATION_SETTINGS);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setSaved(null);
    setError(null);
    void fetch(`/api/management/moderation/settings?surface=${surface}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setSettings(data.settings);
        setReplay(data.replay);
        setLoaded(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [surface]);

  function patch(path: keyof ModerationSettingsMap, next: Partial<ModerationSettingsMap[typeof path]>) {
    setSettings((current) => ({
      ...current,
      [path]: { ...current[path], ...next },
    }));
    setSaved(null);
  }

  async function save(applyToPending: boolean) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/management/moderation/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, settings, applyToPending }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSettings(data.settings);
      setReplay(data.replay);
      const label = surface === "posts" ? "Posts" : "DM";
      if (data.applied) {
        setSaved(
          `Saved ${label}. Applied to the ${label} queue: ${data.applied.allowed} allowed, ${data.applied.skippedCap} skipped (library full), ${data.applied.stillPending} still pending.`
        );
      } else {
        setSaved(`Saved ${label}. New ${label} scans use these thresholds immediately.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const current = SURFACES.find((s) => s.id === surface)!;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-white">Sensitivity</h1>
      <p className="mt-1 text-sm text-white/50">
        Each surface has its own profile. An item is held when any enabled class is at or above
        its slider. Humans still decide.
      </p>

      <div className="mt-5 flex gap-1 rounded-xl border border-white/10 p-1">
        {SURFACES.map((item) => (
          <Link
            key={item.id}
            href={item.id === "dm" ? "/management/moderation/settings" : `/management/moderation/settings?surface=${item.id}`}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm ${
              surface === item.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/40">{current.blurb}</p>

      <div className={`mt-6 space-y-5 ${loaded ? "" : "opacity-50"}`}>
        {CLASS_CATALOG.map((entry) => {
          const row = settings[entry.path];
          return (
            <label key={entry.path} className="block rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{entry.label}</p>
                  <p className="text-xs text-white/40">{entry.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={!loaded}
                  onChange={(e) => patch(entry.path, { enabled: e.target.checked })}
                />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={!row.enabled || !loaded}
                  value={row.threshold}
                  onChange={(e) => patch(entry.path, { threshold: Number(e.target.value) })}
                  className="w-full"
                />
                <span className="w-12 text-right text-sm text-white/70">{row.threshold.toFixed(2)}</span>
              </div>
            </label>
          );
        })}
      </div>

      {replay ? (
        <div className="mt-6 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70">
          <p className="font-medium text-white">
            What-if on last {replay.sampleSize} scored {surface === "posts" ? "post items" : "DM photos"}
          </p>
          <p className="mt-2 text-xs text-white/50">
            After save (or apply): {replay.pendingWouldAllow} pending would flip to allow ·{" "}
            {replay.historicalWouldQueue} historical auto-allows would have been queued. This preview
            updates after you save.
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {saved ? <p className="mt-4 text-sm text-emerald-300/80">{saved}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !loaded}
          onClick={() => void save(false)}
          className="rounded-lg bg-[#FF2D8A] px-4 py-2 text-sm font-medium text-[#07060B] disabled:opacity-60"
        >
          Save {current.label.split(" ")[0]} thresholds
        </button>
        <button
          type="button"
          disabled={busy || !loaded}
          onClick={() => void save(true)}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 disabled:opacity-60"
        >
          Save and apply to pending
        </button>
      </div>
    </div>
  );
}

export default function SensitivityPage() {
  return (
    <Suspense>
      <Sensitivity />
    </Suspense>
  );
}
