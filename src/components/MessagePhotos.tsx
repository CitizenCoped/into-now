"use client";

/**
 * MessagePhotos — photo attachments inside a DM bubble, per the v3 photo
 * messaging handoff (design_handoff_photo_messaging/).
 *
 * Same privacy contract as BlurredPhoto.tsx: unrevealed viewers receive
 * ONLY `blurDataUrl` (~300B placeholder); the presigned `url` exists solely
 * once the server has granted this viewer a reveal, and the reveal is a
 * 500ms crossfade from the blur layer. Never pass the real URL and rely on
 * CSS to hide it.
 *
 * States per photo (see prototype "Photo Messaging v3.dc.html"):
 * - blurred (recipient default): blur(16px) saturate(.85) placeholder,
 *   lock icon + orange "Tap to reveal" pill; whole tile is tappable.
 * - revealed: full image, crossfaded in over 500ms.
 * - hidden by sender: blur + dark overlay + eye-off; "Hidden by sender"
 *   for the recipient, "Hidden" for the sender. Server-authoritative.
 * - LIVE badge on camera-only captures.
 * - sender: 26px circular closed-eye toggle, top-right of each photo.
 */

import { FEATURES } from "@/lib/flags";
import type { MessagePhotoView } from "@/lib/photoTypes";
import { useState } from "react";

type Props = {
  photos: MessagePhotoView[];
  /** Whether the current viewer sent this message. */
  isMine: boolean;
  /** Message has body text above the grid (controls top margin). */
  hasText: boolean;
  onReveal: (photoId: string) => void;
  onToggleHide: (photoId: string, currentHidden: boolean) => void;
};

function PhotoTile({
  photo,
  isMine,
  onReveal,
  onToggleHide,
}: {
  photo: MessagePhotoView;
  isMine: boolean;
  onReveal: (photoId: string) => void;
  onToggleHide: (photoId: string, currentHidden: boolean) => void;
}) {
  const [fullLoaded, setFullLoaded] = useState(false);

  const hidden = photo.hiddenBySender;
  const showFull = !hidden && photo.revealed && Boolean(photo.url);
  const canTap = !isMine && !hidden && !showFull;

  return (
    <div
      onClick={canTap ? () => onReveal(photo.photoId) : undefined}
      role={canTap ? "button" : undefined}
      aria-label={canTap ? "Tap to reveal photo" : undefined}
      className="relative overflow-hidden border border-white/10 bg-[#0b0914]"
      style={{
        aspectRatio: 1,
        borderRadius: 10,
        cursor: canTap ? "pointer" : "default",
      }}
    >
      {/* Blur placeholder layer — always mounted so the reveal crossfades
          from it instead of popping. inset -8% hides blur edge bleed. */}
      <img
        src={photo.blurDataUrl}
        alt={showFull ? "" : "Blurred photo"}
        aria-hidden={showFull}
        draggable={false}
        className="absolute object-cover"
        style={{
          inset: "-8%",
          width: "116%",
          height: "116%",
          filter: "blur(16px) saturate(.85)",
        }}
      />

      {/* Full-resolution layer — only ever mounted post-reveal. */}
      {showFull && (
        <img
          src={photo.url!}
          alt="Photo"
          draggable={false}
          onLoad={() => setFullLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            fullLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Lock + tap-to-reveal pill: recipient, unrevealed, not hidden. */}
      {!isMine && !showFull && !hidden && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ gap: 6, background: "rgba(0,0,0,.3)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FF8A1E"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span
            className="font-semibold text-[#FF8A1E]"
            style={{
              fontSize: 10,
              background: "rgba(255,138,30,.15)",
              border: "1px solid rgba(255,138,30,.4)",
              borderRadius: 99,
              padding: "3px 9px",
            }}
          >
            Tap to reveal
          </span>
        </div>
      )}

      {/* Hidden-by-sender overlay — both sides see it. */}
      {hidden && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ gap: 5, background: "rgba(6,4,12,.45)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,.6)"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <line x1="4" y1="20" x2="20" y2="4" />
          </svg>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,.55)" }}>
            {isMine ? "Hidden" : "Hidden by sender"}
          </span>
        </div>
      )}

      {/* LIVE badge — camera-only capture. Shown to the sender always, and
          to the recipient once revealed (the blur state stays anonymous). */}
      {photo.isLive && (isMine ? !hidden : showFull) && (
        <span
          className="absolute flex items-center font-bold uppercase text-[#FF9E2C]"
          style={{
            left: 6,
            top: 6,
            gap: 4,
            borderRadius: 99,
            background: "rgba(0,0,0,.6)",
            padding: "2px 7px",
            fontSize: 8,
            letterSpacing: ".08em",
            textShadow: "0 0 6px #FF9E2C",
          }}
        >
          <span
            className="rounded-full bg-[#FF9E2C]"
            style={{ width: 5, height: 5, boxShadow: "0 0 6px #FF9E2C" }}
          />
          Live
        </span>
      )}

      {/* Closed-eye toggle — sender only, 26px circle, top-right. */}
      {isMine && (
        <button
          type="button"
          title={hidden ? "Show photo again" : "Hide this photo for everyone"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleHide(photo.photoId, hidden);
          }}
          className="absolute flex items-center justify-center"
          style={{
            right: 6,
            top: 6,
            width: 26,
            height: 26,
            borderRadius: 99,
            background: "rgba(0,0,0,.55)",
            border: "1px solid rgba(255,255,255,.15)",
            color: "rgba(255,255,255,.75)",
            padding: 0,
          }}
        >
          {hidden ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
              <line x1="4" y1="20" x2="20" y2="4" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

export default function MessagePhotos({
  photos,
  isMine,
  hasText,
  onReveal,
  onToggleHide,
}: Props) {
  // Hard gate: feature is dark until legal review clears photos.
  if (!FEATURES.photoBlur || photos.length === 0) return null;

  return (
    <div
      className="grid"
      // Photo taps must not toggle the bubble's expand/collapse.
      onClick={(e) => e.stopPropagation()}
      style={{
        gridTemplateColumns: photos.length > 1 ? "1fr 1fr" : "1fr",
        gap: 6,
        marginTop: hasText ? 8 : 0,
      }}
    >
      {photos.map((photo) => (
        <PhotoTile
          key={photo.photoId}
          photo={photo}
          isMine={isMine}
          onReveal={onReveal}
          onToggleHide={onToggleHide}
        />
      ))}
    </div>
  );
}
