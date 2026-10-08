"use client";

/**
 * PostMediaCard — one item from the public Posts section, with the admin
 * controls: Take down / Restore (this item), Re-scan (fresh Sightengine
 * scores against the Posts profile; never changes visibility), and
 * Hide post / Unhide post (the whole post).
 */

import type { PostMediaCard as PostMediaCardData, RescanDecision } from "@/lib/managementTypes";
import { CLASS_CATALOG, type ModerationSettingsMap } from "@/lib/moderationCatalog";
import { formatDuration } from "@/lib/videoProbe";
import Link from "next/link";
import { useState } from "react";
import ScoreBars, { MediaPane, Pill } from "./ScoreBars";

export type PostMediaAction = "takedown" | "restore" | "rescan" | "hide" | "unhide";

const STATE_TONE = {
  live: "good",
  hidden: "accent",
  held: "neutral",
  expired: "muted",
} as const;

const STATE_LABEL = {
  live: "Live",
  hidden: "Taken down",
  held: "Held",
  expired: "Expired",
} as const;

function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(Math.abs(diff) / 60_000);
  const text = minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} hr`;
  return diff < 0 ? `${text} ago` : `in ${text}`;
}

function labelFor(path: string): string {
  return CLASS_CATALOG.find((entry) => entry.path === path)?.label ?? path;
}

export default function PostMediaCard({
  item,
  settings,
  busy,
  decision,
  onAction,
}: {
  item: PostMediaCardData;
  /** The Posts profile. */
  settings: ModerationSettingsMap;
  busy?: boolean;
  /** Result of the last re-scan on this item, if any. */
  decision?: RescanDecision | null;
  onAction?: (action: PostMediaAction, reason?: string) => void;
}) {
  const [reasonFor, setReasonFor] = useState<"takedown" | "hide" | null>(null);
  const [reason, setReason] = useState("");

  const mediaHidden = Boolean(item.adminHidden);
  const postHidden = Boolean(item.post?.hidden);
  const canAct = Boolean(onAction) && !busy;

  function submitReason() {
    if (!reasonFor || !onAction) return;
    onAction(reasonFor, reason.trim() || undefined);
    setReasonFor(null);
    setReason("");
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="grid gap-0 md:grid-cols-[minmax(0,280px)_1fr]">
        <MediaPane
          url={item.imageUrl}
          kind={item.kind}
          blurDataUrl={item.blurDataUrl}
          alt="Post media"
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white">{item.userContact}</p>
              <p className="text-xs text-white/40">
                Uploaded {new Date(item.createdAt).toLocaleString()}
                {item.durationMs !== null ? ` · ${formatDuration(item.durationMs)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone={item.kind === "video" ? "cyan" : "neutral"}>{item.kind}</Pill>
              <Pill tone={STATE_TONE[item.state]}>{STATE_LABEL[item.state]}</Pill>
              {item.reviewStatus ? <Pill>{item.reviewStatus}</Pill> : null}
            </div>
          </div>

          {item.post ? (
            <div className="rounded-xl border border-white/10 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white">
                  <span className="mr-2 text-[11px] font-extrabold tracking-[.14em] text-[#FF2D8A]">
                    {item.post.code}
                  </span>
                  {item.post.title}
                </p>
                {postHidden ? <Pill tone="accent">Post hidden</Pill> : null}
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                Posted {relative(item.post.createdAt)} ·{" "}
                {item.post.expired ? "expired" : `expires ${relative(item.post.expiresAt)}`}
                {item.post.hidden ? (
                  <>
                    {" "}
                    · hidden {relative(item.post.hidden.at)}
                    {item.post.hidden.byUsername ? ` by ${item.post.hidden.byUsername}` : ""}
                    {item.post.hidden.reason ? ` — “${item.post.hidden.reason}”` : ""}
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="text-xs text-white/40">
              Not attached to a post{item.state === "held" ? " — held at upload." : "."}
            </p>
          )}

          {item.adminHidden ? (
            <p className="text-xs text-[#FF2D8A]">
              Taken down {relative(item.adminHidden.at)}
              {item.adminHidden.byUsername ? ` by ${item.adminHidden.byUsername}` : ""}
              {item.adminHidden.reason ? ` — “${item.adminHidden.reason}”` : ""}
            </p>
          ) : null}

          <ScoreBars scores={item.scores} settings={settings} />
          {item.rescannedAt ? (
            <p className="text-[11px] text-white/35">Re-scanned {relative(item.rescannedAt)}</p>
          ) : null}

          {decision ? (
            <p className={`text-xs ${decision.wouldReject ? "text-[#FF2D8A]" : "text-emerald-200/80"}`}>
              Re-scan:{" "}
              {decision.skipped
                ? "skipped (Sightengine not configured)"
                : decision.wouldReject
                  ? `would reject — ${decision.triggered
                      .map((t) => `${labelFor(t.path)} ${t.score.toFixed(2)} / ${t.threshold.toFixed(2)}`)
                      .join(", ")}`
                  : `would pass (top ${decision.topClass ? labelFor(decision.topClass) : "—"} ${decision.topScore.toFixed(2)})`}
            </p>
          ) : null}

          {onAction ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {mediaHidden ? (
                  <button
                    type="button"
                    disabled={!canAct}
                    onClick={() => onAction("restore")}
                    className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canAct || item.state === "held"}
                    onClick={() => setReasonFor(reasonFor === "takedown" ? null : "takedown")}
                    className="rounded-lg bg-[#FF2D8A] px-3 py-2 text-sm font-medium text-[#07060B] disabled:opacity-60"
                  >
                    Take down
                  </button>
                )}
                <button
                  type="button"
                  disabled={!canAct || !item.imageUrl}
                  onClick={() => onAction("rescan")}
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 disabled:opacity-60"
                >
                  Re-scan
                </button>
                {item.post ? (
                  postHidden ? (
                    <button
                      type="button"
                      disabled={!canAct}
                      onClick={() => onAction("unhide")}
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 disabled:opacity-60"
                    >
                      Unhide post
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAct}
                      onClick={() => setReasonFor(reasonFor === "hide" ? null : "hide")}
                      className="rounded-lg border border-[#FF2D8A]/40 px-3 py-2 text-sm text-[#FF2D8A] disabled:opacity-60"
                    >
                      Hide post
                    </button>
                  )
                ) : null}
                <Link
                  href={`/management/posts/${item.id}`}
                  className="self-center text-xs text-white/40 hover:text-white"
                >
                  Open
                </Link>
              </div>

              {reasonFor ? (
                <div className="rounded-xl border border-white/10 p-3">
                  <label className="block text-xs text-white/50">
                    Reason (optional, shown in the activity log)
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#FF2D8A]/50"
                    />
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={!canAct}
                      onClick={submitReason}
                      className="rounded-lg bg-[#FF2D8A] px-3 py-1.5 text-xs font-medium text-[#07060B] disabled:opacity-60"
                    >
                      {reasonFor === "takedown" ? "Confirm take down" : "Confirm hide post"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReasonFor(null);
                        setReason("");
                      }}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
