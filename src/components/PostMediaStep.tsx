"use client";

/**
 * PostMediaStep — step 2 of 2 of post creation, "Add photos" (frame 2 of
 * design_handoff_the_best_drug/The Best Drug Posts Flow.dc.html).
 *
 * - 2×2 grid of square tiles. Filled: PHOTO/VIDEO pill top-left (video
 *   pill cyan), × remove top-right; videos get a play glyph, m:ss badge,
 *   and a cyan border. Empty: dashed + circle + "Photo or video".
 * - Scanning tile reuses the silent sweep from PhotoSheet; rejected tile
 *   flashes "Can't be shared" then drops (usePostMedia handles timing).
 * - Counter: `2 photos · 1 video · 1 slot left` / `Screened before they show`.
 * - Sources: Camera (live capture, photo) / Library (device picker,
 *   photos + videos).
 */

import { MAX_POST_MEDIA, MAX_POST_VIDEO_SECONDS, MAX_POST_VIDEOS } from "@/lib/photoTypes";
import { formatDuration } from "@/lib/videoProbe";
import type { PostMediaItem } from "@/hooks/usePostMedia";
import { useRef, useState } from "react";
import { CameraCapture } from "./PhotoSheet";
import { PlayGlyph } from "./PostMediaStrip";

type Props = {
  items: PostMediaItem[];
  error: string;
  preparing: boolean;
  photoCount: number;
  videoCount: number;
  slotsLeft: number;
  onAddFile: (file: Blob, isLive: boolean) => Promise<string | null>;
  onRemove: (id: string) => void;
};

function MediaTile({ item, onRemove }: { item: PostMediaItem; onRemove: (id: string) => void }) {
  const rejected = item.status === "rejected";
  const isVideo = item.kind === "video";
  return (
    <div
      className="relative overflow-hidden bg-[#0b0914]"
      style={{
        aspectRatio: 1,
        borderRadius: 14,
        border: rejected
          ? "1px solid rgba(255,45,138,.35)"
          : `1px solid ${isVideo ? "rgba(0,240,255,.35)" : "rgba(255,255,255,.12)"}`,
      }}
    >
      {!rejected &&
        (isVideo ? (
          <video
            src={item.previewUrl}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={item.previewUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ))}

      {item.status === "scanning" && (
        <div className="absolute inset-0 overflow-hidden" style={{ background: "rgba(6,4,12,.55)" }}>
          <div
            className="absolute left-0 right-0"
            style={{
              height: "36%",
              top: "-40%",
              background: "linear-gradient(180deg,transparent,rgba(255,45,138,.5),transparent)",
              animation: "scanSweep .45s linear infinite",
            }}
          />
        </div>
      )}

      {rejected && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ gap: 6, background: "rgba(255,45,138,.06)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF2D8A" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span style={{ fontSize: 9, color: "#FF2D8A" }}>Can&apos;t be shared</span>
        </div>
      )}

      {!rejected && (
        <>
          <span
            className="absolute left-2 top-2 rounded-full px-2 py-[3px] text-[10px] font-bold uppercase tracking-[.08em]"
            style={{ background: "rgba(7,6,11,.7)", color: isVideo ? "#00F0FF" : "#fff" }}
          >
            {isVideo ? "Video" : "Photo"}
          </span>
          <button
            type="button"
            aria-label="Remove"
            onClick={() => onRemove(item.id)}
            className="absolute right-1.5 top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm leading-none text-white"
            style={{ background: "rgba(7,6,11,.75)" }}
          >
            ×
          </button>
          {isVideo && (
            <>
              <span className="absolute inset-0 flex items-center justify-center">
                <PlayGlyph />
              </span>
              {item.durationMs !== null && (
                <span
                  className="absolute bottom-2 right-2 rounded-md px-[7px] py-[2px] text-[11px] font-semibold tabular-nums text-white"
                  style={{ background: "rgba(7,6,11,.75)" }}
                >
                  {formatDuration(item.durationMs)}
                </span>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function PostMediaStep({
  items,
  error,
  preparing,
  photoCount,
  videoCount,
  slotsLeft,
  onAddFile,
  onRemove,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const visible = items.filter((m) => m.status !== "rejected");
  const full = slotsLeft <= 0;
  const emptySlots = Math.max(0, MAX_POST_MEDIA - visible.length);
  const canAdd = !full && !preparing;

  const s = (n: number) => (n === 1 ? "" : "s");

  return (
    <>
      <p className="mt-2.5 font-display italic uppercase text-[22px] leading-none tracking-[.04em] text-white">
        Add photos
      </p>
      <p className="mt-1 text-[12.5px] leading-[1.45] text-white/55">
        Posts with photos get answered. Up to{" "}
        <span className="font-semibold text-white">{MAX_POST_MEDIA} photos</span>, or{" "}
        <span className="font-semibold text-white">
          {MAX_POST_MEDIA - MAX_POST_VIDEOS} photos + {MAX_POST_VIDEOS} videos
        </span>
        . Videos max{" "}
        <span className="font-semibold text-[#00F0FF]">{MAX_POST_VIDEO_SECONDS} seconds</span>.
      </p>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        {items.map((item) => (
          <MediaTile key={item.id} item={item} onRemove={onRemove} />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <button
            key={`empty-${i}`}
            type="button"
            disabled={!canAdd}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add photo or video"
            className="flex flex-col items-center justify-center gap-1.5 text-white/45 disabled:opacity-50"
            style={{
              aspectRatio: 1,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(255,255,255,.03)",
              cursor: canAdd ? "pointer" : "default",
            }}
          >
            <span
              className="flex items-center justify-center text-xl leading-none"
              style={{
                width: 36,
                height: 36,
                borderRadius: 9999,
                border: "1.5px dashed rgba(255,255,255,.3)",
              }}
            >
              +
            </span>
            <span className="text-[11px] font-semibold">Photo or video</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-white/45">
        <span>
          <span className="font-semibold text-white">{photoCount}</span> photo{s(photoCount)} ·{" "}
          <span className="font-semibold text-white">{videoCount}</span> video{s(videoCount)} ·{" "}
          {full ? "full" : `${slotsLeft} slot${s(slotsLeft)} left`}
        </span>
        <span className="text-white/35">Screened before they show</span>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] text-[#FF2D8A]">{error}</p>
      ) : preparing ? (
        <p className="mt-2 text-[11px] text-white/40">Preparing…</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => setCameraOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-white/[.12] bg-white/[.04] py-[11px] text-[13px] font-semibold text-white transition hover:bg-white/[.08] disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Camera
        </button>
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-white/[.12] bg-white/[.04] py-[11px] text-[13px] font-semibold text-white transition hover:bg-white/[.08] disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          Library
        </button>
      </div>

      {/* Images + the video containers phones produce. The normalizer handles
          whatever image arrives; videos are probed for length and uploaded
          as-is. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && canAdd) void onAddFile(file, false);
        }}
      />

      {cameraOpen && (
        <CameraCapture
          onCapture={(blob) => void onAddFile(blob, true)}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  );
}
