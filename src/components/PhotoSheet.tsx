"use client";

/**
 * PhotoSheet — the "My photos" library grid that slides open above the DM
 * composer (design_handoff_photo_messaging/, prototype panel).
 *
 * - 5-column grid, `n/10` library count, `n/5 selected`.
 * - Selection = 2px #FF8A1E border + ordered number badge (send order).
 * - Dashed add-tile → file picker; dashed orange camera-tile →
 *   getUserMedia capture (marks the photo LIVE). At 10/10 the add tile
 *   goes inert and shows "10/10" until a photo is removed.
 * - Scanning tile: photo dimmed rgba(6,4,12,.55) + orange sweep bar
 *   (scanSweep .45s loop, keyframes in globals.css). NO text — the sweep
 *   runs for the real upload + moderation latency.
 * - Rejected tile: danger state ("Can't be shared") flashes briefly, then
 *   the photo is removed (usePhotoLibrary handles the timing).
 * - Long-press a ready tile to remove it from the library.
 */

import type { LibraryPhoto } from "@/lib/photoTypes";
import { MAX_LIBRARY_PHOTOS, MAX_PHOTOS_PER_MESSAGE } from "@/lib/photoTypes";
import { useEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 550;

type Props = {
  photos: LibraryPhoto[];
  /** photoId → local object URL for photos uploaded this session. */
  previewUrls: Record<string, string>;
  /** Ordered selection (send order). */
  selectedIds: string[];
  error: string;
  onToggleSelect: (photoId: string) => void;
  onUpload: (file: Blob, isLive: boolean) => Promise<string | null>;
  onDelete: (photoId: string) => void;
};

function LibraryTile({
  photo,
  previewUrl,
  selectionIndex,
  onToggleSelect,
  onDelete,
}: {
  photo: LibraryPhoto;
  previewUrl?: string;
  selectionIndex: number;
  onToggleSelect: (photoId: string) => void;
  onDelete: (photoId: string) => void;
}) {
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  function startPress() {
    if (photo.status !== "ready") return;
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      if (window.confirm("Remove this photo from your library?")) {
        onDelete(photo.id);
      }
    }, LONG_PRESS_MS);
  }

  function endPress() {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  useEffect(() => endPress, []);

  const selected = selectionIndex >= 0;
  const rejected = photo.status === "rejected";

  return (
    <div
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (longPressed.current) return;
        if (photo.status !== "ready") return;
        onToggleSelect(photo.id);
      }}
      role="button"
      aria-label={selected ? "Deselect photo" : "Select photo"}
      className="relative overflow-hidden bg-[#0b0914]"
      style={{
        aspectRatio: 1,
        borderRadius: 9,
        border: rejected
          ? "1px solid rgba(255,77,109,.35)"
          : `2px solid ${selected ? "#FF8A1E" : "rgba(255,255,255,.12)"}`,
        cursor: photo.status === "ready" ? "pointer" : "default",
        touchAction: "none",
      }}
    >
      {!rejected && (
        <img
          src={previewUrl ?? photo.blurDataUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Silent scanning sweep — no text ever. */}
      {photo.status === "scanning" && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ background: "rgba(6,4,12,.55)" }}
        >
          <div
            className="absolute left-0 right-0"
            style={{
              height: "36%",
              top: "-40%",
              background:
                "linear-gradient(180deg,transparent,rgba(255,138,30,.5),transparent)",
              animation: "scanSweep .45s linear infinite",
            }}
          />
        </div>
      )}

      {/* Rejected danger tile — shown briefly before removal. */}
      {rejected && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ gap: 6, background: "rgba(255,77,109,.06)" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FF4D6D"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span style={{ fontSize: 9, color: "#FF4D6D" }}>Can&apos;t be shared</span>
        </div>
      )}

      {/* LIVE dot — camera captures. */}
      {photo.isLive && !rejected && (
        <span
          className="absolute rounded-full bg-[#FF9E2C]"
          style={{ left: 4, top: 4, width: 6, height: 6, boxShadow: "0 0 6px #FF9E2C" }}
        />
      )}

      {/* Ordered selection badge. */}
      {selected && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-[#FF8A1E] text-[#06040c]"
          style={{ right: 4, top: 4, width: 16, height: 16, fontSize: 9, fontWeight: 800 }}
        >
          {selectionIndex + 1}
        </span>
      )}
    </div>
  );
}

function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setCameraError("Camera unavailable. Check permissions."));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
        onClose();
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0f0d18] shadow-2xl">
        {cameraError ? (
          <p className="p-5 text-sm text-[#FF4D6D]">{cameraError}</p>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-square w-full bg-black object-cover"
          />
        )}
        <div className="flex gap-2 p-4">
          <button
            type="button"
            onClick={capture}
            disabled={Boolean(cameraError)}
            className="flex-1 rounded-lg bg-gradient-to-r from-[#FFB03A] to-[#F56A00] py-2 text-sm font-semibold text-[#06040c] transition hover:brightness-110 disabled:opacity-50"
          >
            Capture
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-white/60 transition hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PhotoSheet({
  photos,
  previewUrls,
  selectedIds,
  error,
  onToggleSelect,
  onUpload,
  onDelete,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const visible = photos.filter((p) => p.status !== "rejected");
  const full = visible.length >= MAX_LIBRARY_PHOTOS;

  return (
    <div
      style={{
        borderTop: "1px solid rgba(255,255,255,.06)",
        background: "rgba(255,255,255,.02)",
        padding: "10px 16px 12px",
      }}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span
          className="font-semibold uppercase"
          style={{ fontSize: 10, letterSpacing: ".08em", color: "rgba(255,255,255,.4)" }}
        >
          My photos
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.35)" }}>
          {visible.length}/{MAX_LIBRARY_PHOTOS} · {selectedIds.length}/
          {MAX_PHOTOS_PER_MESSAGE} selected
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
        {photos.map((photo) => (
          <LibraryTile
            key={photo.id}
            photo={photo}
            previewUrl={previewUrls[photo.id]}
            selectionIndex={selectedIds.indexOf(photo.id)}
            onToggleSelect={onToggleSelect}
            onDelete={onDelete}
          />
        ))}

        {/* Add tile — dashed; goes inert at 10/10 until one is removed. */}
        <button
          type="button"
          title={full ? "Library full — remove a photo first" : "Upload from library"}
          disabled={full}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center bg-transparent"
          style={{
            aspectRatio: 1,
            borderRadius: 9,
            border: "1px dashed rgba(255,255,255,.2)",
            color: full ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.5)",
            gap: 5,
            cursor: full ? "default" : "pointer",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {full && <span style={{ fontSize: 9 }}>{MAX_LIBRARY_PHOTOS}/{MAX_LIBRARY_PHOTOS}</span>}
        </button>

        {/* Camera tile — getUserMedia capture, marks LIVE. */}
        {!full && (
          <button
            type="button"
            title="Live camera capture"
            onClick={() => setCameraOpen(true)}
            className="flex items-center justify-center bg-transparent text-[#FF9E2C]"
            style={{
              aspectRatio: 1,
              borderRadius: 9,
              border: "1px dashed rgba(255,158,44,.35)",
              cursor: "pointer",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2" style={{ fontSize: 10, color: "#FF4D6D" }}>
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onUpload(file, false);
        }}
      />

      {cameraOpen && (
        <CameraCapture
          onCapture={(blob) => void onUpload(blob, true)}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
