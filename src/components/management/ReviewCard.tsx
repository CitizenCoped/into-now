"use client";

import type { ReviewCard as ReviewCardData } from "@/lib/managementTypes";
import { SURFACE_LABELS, type ModerationSettingsMap } from "@/lib/moderationCatalog";
import Link from "next/link";
import ScoreBars, { MediaPane, Pill } from "./ScoreBars";

export default function ReviewCard({
  photo,
  settings,
  busy,
  onAllow,
  onUphold,
}: {
  photo: ReviewCardData;
  /** Thresholds for this item's surface (DM or Posts). */
  settings: ModerationSettingsMap;
  busy?: boolean;
  onAllow?: () => void;
  onUphold?: () => void;
}) {
  const pending = photo.reviewStatus === "pending";

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="grid gap-0 md:grid-cols-[minmax(0,280px)_1fr]">
        <MediaPane
          url={photo.imageUrl}
          kind={photo.kind}
          blurDataUrl={photo.blurDataUrl}
          alt="Held media"
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white">{photo.userContact}</p>
              <p className="text-xs text-white/40">{new Date(photo.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone={photo.kind === "video" ? "cyan" : "neutral"}>{photo.kind}</Pill>
              <Pill tone={photo.surface === "posts" ? "accent" : "neutral"}>
                {SURFACE_LABELS[photo.surface]}
              </Pill>
              <Pill>{photo.reviewStatus ?? photo.status}</Pill>
            </div>
          </div>

          <ScoreBars scores={photo.scores} settings={settings} />

          {photo.postId ? (
            <Link
              href={`/management/posts/${photo.id}`}
              className="inline-block text-xs text-white/40 hover:text-white"
            >
              Attached to a post → open in Posts
            </Link>
          ) : null}

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
