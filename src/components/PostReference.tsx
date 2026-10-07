"use client";

/**
 * PostReference — the other user's latest live post, surfaced inside a DM
 * thread (frame 3 of design_handoff_the_best_drug/The Best Drug Posts
 * Flow.dc.html).
 *
 * - `PostReferenceRow`: tappable row between the name row and the
 *   messages — code · "THEIR LATEST POST · 26 MIN AGO" · Anton headline ·
 *   up to two overlapping thumbs · ›.
 * - `PostReferencePopup`: bottom-anchored sheet over the messenger with the
 *   full post + media grid. Closing lands back in the same thread.
 */

import { CODE_COLORS, isIdentityToken } from "@/lib/codes";
import { haversineMiles } from "@/lib/geo";
import type { ConversationSummary } from "@/hooks/useMessages";
import { POST_TTL_MS } from "@/lib/postConfig";
import { expiresIn, timeAgo } from "@/lib/timeAgo";
import { useEffect } from "react";
import { PostMediaTile } from "./PostMediaStrip";

export type LatestPost = NonNullable<NonNullable<ConversationSummary["otherUser"]>["latestPost"]>;

function codeColor(posterIs: string): string {
  return isIdentityToken(posterIs) ? CODE_COLORS[posterIs] : "#FF2D8A";
}

/** Thumb background: the loaded media if we have a URL, else the blur. */
function thumbStyle(item: LatestPost["media"][number]): React.CSSProperties {
  return {
    width: 26,
    height: 26,
    borderRadius: 7,
    border: "1.5px solid #120A14",
    backgroundImage: `url("${item.url ?? item.blurDataUrl}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

export function PostReferenceRow({ post, onOpen }: { post: LatestPost; onOpen: () => void }) {
  const thumbs = post.media.slice(0, 2);
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open their latest post"
        className="flex w-full shrink-0 items-center gap-2.5 text-left transition hover:border-[#FF2D8A]"
        style={{
          borderRadius: 12,
          border: "1px solid rgba(255,45,138,.35)",
          background: "linear-gradient(90deg,rgba(255,45,138,.14),rgba(255,45,138,.04))",
          padding: "10px 12px",
        }}
      >
        <span
          className="shrink-0 text-[10px] font-extrabold tracking-[.14em]"
          style={{ color: codeColor(post.posterIs) }}
        >
          {post.category}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[9.5px] font-bold uppercase tracking-[.14em] text-white/40">
            Their latest post · {timeAgo(post.createdAt)}
          </span>
          <span className="truncate font-display italic uppercase text-[15px] tracking-[.02em] text-white">
            {post.title}
          </span>
        </span>
        {thumbs.length > 0 && (
          <span className="flex shrink-0">
            {thumbs.map((item, i) => (
              <span key={item.id} style={{ ...thumbStyle(item), marginLeft: i === 0 ? 0 : -10 }} />
            ))}
          </span>
        )}
        <span className="shrink-0 text-sm text-white/50" aria-hidden>
          ›
        </span>
      </button>
      <div className="my-2.5 h-px shrink-0 bg-white/5" />
    </>
  );
}

export function PostReferencePopup({
  post,
  viewerLocation,
  onClose,
}: {
  post: LatestPost;
  viewerLocation: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  // Escape closes, like any sheet.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const miles = viewerLocation
    ? haversineMiles(viewerLocation.lat, viewerLocation.lng, post.lat, post.lng)
    : null;
  const meta = [
    "Anonymous",
    miles !== null ? `${miles < 0.1 ? "<0.1" : miles.toFixed(1)} mi` : null,
    timeAgo(post.createdAt),
    expiresIn(post.createdAt, POST_TTL_MS),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      onClick={onClose}
      role="presentation"
      className="absolute inset-0 z-[60] flex items-end justify-center px-3 pb-6"
      style={{ background: "rgba(7,6,11,.7)", backdropFilter: "blur(6px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Their latest post"
        className="flex w-full flex-col overflow-hidden"
        style={{
          maxHeight: 720,
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,.12)",
          background: "#160C19",
          boxShadow: "0 30px 60px -12px rgba(0,0,0,.8)",
        }}
      >
        <div className="flex shrink-0 items-center justify-between px-4 pt-3.5">
          <span
            className="text-[11px] font-extrabold tracking-[.18em]"
            style={{ color: codeColor(post.posterIs) }}
          >
            {post.category}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-white/[.12] text-base leading-none text-white/70 transition hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
          <p className="font-display italic uppercase text-[26px] leading-[1.05] tracking-[.02em] text-white">
            {post.title}
          </p>
          <p className="mt-1.5 text-[11px] text-white/40">{meta}</p>
          <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-[1.5] text-white/80">
            {post.description}
          </p>
          {post.media.length > 0 && (
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              {post.media.map((item) => (
                <PostMediaTile key={item.id} item={item} />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-[10px] border border-[#00F0FF]/35 bg-[#00F0FF]/10 py-[11px] text-[13px] font-semibold text-[#00F0FF] transition hover:bg-[#00F0FF]/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
