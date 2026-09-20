"use client";

import { CLASS_CATALOG, type ModerationSettingsMap } from "@/lib/moderationCatalog";
import { useState } from "react";

type PlayResult = {
  ok: boolean;
  skipped: boolean;
  topScore: number;
  topClass: string | null;
  scores: Record<string, number>;
  triggered: { path: string; score: number; threshold: number }[];
  raw: Record<string, unknown> | null;
};

export default function PlaygroundPage() {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [settings, setSettings] = useState<ModerationSettingsMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        form.set("file", file);
        res = await fetch("/api/management/moderation/playground", { method: "POST", body: form });
      } else {
        res = await fetch("/api/management/moderation/playground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setResult(data.result);
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-white">Playground</h1>
      <p className="mt-1 text-sm text-white/50">
        Run a live Sightengine check. Nothing is written to a user’s library.
      </p>

      <form onSubmit={(e) => void run(e)} className="mt-6 space-y-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… public image URL"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#FF2D8A]/50"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-white/60"
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || (!file && !url.trim())}
          className="rounded-lg bg-[#FF2D8A] px-4 py-2 text-sm font-medium text-[#07060B] disabled:opacity-60"
        >
          {busy ? "Scanning…" : "Scan"}
        </button>
      </form>

      {result ? (
        <div className="mt-6 space-y-3">
          <p className={`text-sm font-medium ${result.ok ? "text-emerald-300" : "text-[#FF2D8A]"}`}>
            {result.skipped ? "Skipped (no credentials)" : result.ok ? "Would pass" : "Would hold for review"}
          </p>
          {settings
            ? CLASS_CATALOG.filter((entry) => settings[entry.path]?.enabled).map((entry) => (
                <p key={entry.path} className="text-xs text-white/50">
                  {entry.label}: {(result.scores[entry.path] ?? 0).toFixed(3)} (threshold{" "}
                  {settings[entry.path].threshold.toFixed(2)})
                </p>
              ))
            : null}
          {result.raw ? (
            <pre className="max-h-96 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/50">
              {JSON.stringify(result.raw, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
