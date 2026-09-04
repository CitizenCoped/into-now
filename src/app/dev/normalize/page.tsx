"use client";

/**
 * /dev/normalize — local-only harness for src/lib/imageNormalize.ts.
 *
 * Drop any file (HEIC from an iPhone, 48MP JPEG, transparent PNG, GIF…) and
 * see which decoder handled it, how long it took, and the output. Use it on
 * desktop Chrome/Firefox to exercise the lazy WASM HEIC path without going
 * through the DM flow. Returns 404 in production builds.
 */

import {
  AVATAR_NORMALIZE,
  DM_PHOTO_NORMALIZE,
  decodeErrorMessage,
  normalizeImage,
  type NormalizedImage,
} from "@/lib/imageNormalize";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

const PRESETS = {
  dm: DM_PHOTO_NORMALIZE,
  avatar: AVATAR_NORMALIZE,
} as const;

type PresetKey = keyof typeof PRESETS;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function NormalizeHarness() {
  if (process.env.NODE_ENV === "production") notFound();

  const [preset, setPreset] = useState<PresetKey>("dm");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NormalizedImage | null>(null);
  const [outUrl, setOutUrl] = useState("");
  const [sourceName, setSourceName] = useState("");

  useEffect(() => {
    return () => {
      if (outUrl) URL.revokeObjectURL(outUrl);
    };
  }, [outUrl]);

  async function run(file: File) {
    setBusy(true);
    setError("");
    setResult(null);
    setSourceName(`${file.name || "(unnamed)"} · type="${file.type}" · ${fmtBytes(file.size)}`);
    try {
      const out = await normalizeImage(file, PRESETS[preset]);
      setResult(out);
      setOutUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(out.blob);
      });
    } catch (err) {
      setError(`${decodeErrorMessage(err)}  [${err instanceof Error ? err.message : String(err)}]`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 text-sm text-white">
      <h1 className="mb-1 text-lg font-semibold">imageNormalize harness</h1>
      <p className="mb-4 text-white/50">
        Dev only. Pick any image; the same code path the DM sheet and avatar
        editor use runs here.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2">
          Preset
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as PresetKey)}
            className="rounded border border-white/20 bg-black px-2 py-1"
          >
            <option value="dm">DM photo (2048px, ≤4MB)</option>
            <option value="avatar">Avatar (512px, ≤1MB)</option>
          </select>
        </label>
        <input
          type="file"
          accept="image/*,image/heic,image/heif"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void run(f);
          }}
        />
      </div>

      {sourceName && <p className="mb-2 text-white/60">Source: {sourceName}</p>}
      {busy && <p className="text-[#FF8A1E]">Preparing…</p>}
      {error && <p className="text-[#FF4D6D]">{error}</p>}

      {result && outUrl && (
        <div className="space-y-3">
          <table className="text-xs">
            <tbody>
              <tr><td className="pr-3 text-white/50">decoder</td><td>{result.meta.decoder}</td></tr>
              <tr><td className="pr-3 text-white/50">time</td><td>{result.meta.ms} ms</td></tr>
              <tr><td className="pr-3 text-white/50">output</td><td>{result.width}×{result.height} · {result.blob.type} · {fmtBytes(result.blob.size)}</td></tr>
              <tr><td className="pr-3 text-white/50">aspect</td><td>{result.aspectRatio.toFixed(4)}</td></tr>
              <tr><td className="pr-3 text-white/50">blur</td><td>{result.blurDataUrl.length} chars</td></tr>
            </tbody>
          </table>
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="normalized output" className="max-h-96 max-w-[60%] rounded border border-white/10" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.blurDataUrl}
              alt="blur placeholder"
              className="h-32 w-32 rounded border border-white/10"
              style={{ imageRendering: "auto", filter: "blur(4px)" }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
