"use client";

/**
 * PostMediaStrip — the ordered thumbnail row appended to a post card in
 * the Posts list and the map popup. Post media is public to every viewer
 * (no reveal gate); the blur placeholder only covers the load.
 */

import type { PostMediaView } from "@/lib/photoTypes";
import { formatDuration } from "@/lib/videoProbe";

type Props = {
  media: PostMediaView[];
  /** Thumbnail edge in px. */
  size?: number;
  className?: string;
};

export function PlayGlyph({ size = 40 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full border border-white/40"
      style={{ width: size, height: size, background: "rgba(7,6,11,.6)" }}
      aria-hidden
    >
      <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill="#fff">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

/** One square media tile — photo <img> or looping muted <video>, with the
 *  play glyph + duration badge on videos. */
export function PostMediaTile({
  item,
  radius = 12,
  glyphSize = 40,
  className = "",
}: {
  item: PostMediaView;
  radius?: number;
  glyphSize?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden border border-white/[.08] bg-[#0b0914] ${className}`}
      style={{ aspectRatio: 1, borderRadius: radius }}
    >
      <img
        src={item.blurDataUrl}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg"
      />
      {item.url &&
        (item.kind === "video" ? (
          <video
            src={item.url}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={item.url}
            alt="Post photo"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ))}
      {item.kind === "video" && (
        <>
          <span className="absolute inset-0 flex items-center justify-center">
            <PlayGlyph size={glyphSize} />
          </span>
          {item.durationMs !== null && (
            <span
              className="absolute bottom-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
              style={{ background: "rgba(7,6,11,.75)" }}
            >
              {formatDuration(item.durationMs)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default function PostMediaStrip({ media, size = 56, className = "" }: Props) {
  if (media.length === 0) return null;
  return (
    <div className={`flex gap-1.5 ${className}`} aria-label={`${media.length} attachments`}>
      {media.map((item) => (
        <div key={item.id} style={{ width: size }}>
          <PostMediaTile item={item} radius={8} glyphSize={22} />
        </div>
      ))}
    </div>
  );
}
