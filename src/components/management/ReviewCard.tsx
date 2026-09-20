"use client";

import type { ReviewCard as ReviewCardData } from "@/lib/managementTypes";
import { CLASS_CATALOG, type ModerationSettingsMap } from "@/lib/moderationCatalog";

export default function ReviewCard({
  photo,
  settings,
  busy,
  onAllow,
  onUphold,
}: {
  photo: ReviewCardData;
  settings: ModerationSettingsMap;
  busy?: boolean;
  onAllow?: () => void;
  onUphold?: () => void;
}) {
  const pending = photo.reviewStatus === "pending";

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="grid gap-0 md:grid-cols-[minmax(0,280px)_1fr]">
        <div className="relative min-h-[220px] bg-black/40">
          {photo.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.imageUrl}
              alt="Held photo"
              className="h-full w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.blurDataUrl} alt="" className="h-full w-full object-cover opacity-60" />
          )}
          {!photo.imageUrl ? (
            <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/50">
              Image no longer stored
            </p>
          ) : null}
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white">{photo.userContact}</p>
              <p className="text-xs text-white/40">{new Date(photo.createdAt).toLocaleString()}</p>
            </div>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/60">
              {photo.reviewStatus ?? photo.status}
            </span>
          </div>

          <div className="space-y-2">
            {CLASS_CATALOG.filter((entry) => settings[entry.path]?.enabled).map((entry) => {
              const score = photo.scores?.[entry.path] ?? 0;
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
                      className={`h-full ${tripped ? "bg-[#FF2D8A]" : "bg-[#FF2D8A]"}`}
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

          {pending && onAllow && onUphold ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onAllow}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
              >
                Allow
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onUphold}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 disabled:opacity-60"
              >
                Keep rejected
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
