"use client";

import { CLASS_CATALOG, type ModerationSettingsMap } from "@/lib/moderationCatalog";

/** One bar per enabled class: score vs. the profile's threshold marker. */
export default function ScoreBars({
  scores,
  settings,
}: {
  scores: Record<string, number> | null;
  settings: ModerationSettingsMap;
}) {
  return (
    <div className="space-y-2">
      {CLASS_CATALOG.filter((entry) => settings[entry.path]?.enabled).map((entry) => {
        const score = scores?.[entry.path] ?? 0;
        const threshold = settings[entry.path].threshold;
        const tripped = score >= threshold;
        return (
          <div key={entry.path}>
            <div className="mb-1 flex justify-between text-[11px] text-white/50">
              <span>{entry.label}</span>
              <span className={tripped ? "text-[#FF2D8A]" : ""}>
                {score.toFixed(2)} / {threshold.toFixed(2)}
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full ${tripped ? "bg-[#FF2D8A]" : "bg-white/40"}`}
                style={{ width: `${Math.min(100, score * 100)}%` }}
              />
              <div
                className="absolute top-0 h-full w-px bg-white/70"
                style={{ left: `${threshold * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Small uppercase status/kind pill used across the management cards. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "cyan" | "good" | "muted";
}) {
  const cls = {
    neutral: "border-white/15 text-white/60",
    accent: "border-[#FF2D8A]/40 bg-[#FF2D8A]/10 text-[#FF2D8A]",
    cyan: "border-[#00F0FF]/35 bg-[#00F0FF]/10 text-[#00F0FF]",
    good: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
    muted: "border-white/10 text-white/35",
  }[tone];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

/** Photo or video pane shared by the review and post-media cards. */
export function MediaPane({
  url,
  kind,
  blurDataUrl,
  alt,
}: {
  url: string | null;
  kind: "photo" | "video";
  blurDataUrl: string;
  alt: string;
}) {
  return (
    <div className="relative min-h-[220px] bg-black/40">
      {url ? (
        kind === "video" ? (
          <video
            src={url}
            controls
            muted
            playsInline
            loop
            preload="metadata"
            className="h-full w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} className="h-full w-full object-contain" />
        )
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={blurDataUrl} alt="" className="h-full w-full object-cover opacity-60" />
      )}
      {!url ? (
        <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/50">
          Media no longer stored
        </p>
      ) : null}
    </div>
  );
}
