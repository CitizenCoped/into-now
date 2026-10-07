/**
 * videoProbe — browser-side inspection of a picked video before upload.
 *
 * Videos are uploaded as the phone produced them (no transcode — a 10s
 * clip is small enough), so all we need up front is the duration (to
 * enforce the 10s cap client-side), the aspect ratio, and a poster frame
 * run through the same tiny-JPEG placeholder as photos (src/lib/blur.ts)
 * so the tile and the post strip can render before the clip loads.
 */

import { placeholderFromSource } from "./blur";

export type ProbedVideo = {
  durationMs: number;
  /** width / height — finite and > 0. */
  aspectRatio: number;
  /** 16px blur placeholder from the first frame. */
  blurDataUrl: string;
  /** Object URL of the clip for the local tile; caller revokes. */
  previewUrl: string;
};

const METADATA_TIMEOUT_MS = 8000;
/** Seek a hair past 0 — frame 0 of many phone clips is black. */
const POSTER_SEEK_SECONDS = 0.1;

/** Reasons a probe can fail, for user-facing copy. */
export class VideoProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoProbeError";
  }
}

function once<T>(run: (resolve: (v: T) => void, reject: (e: Error) => void) => void) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new VideoProbeError("That video took too long to read.")),
      METADATA_TIMEOUT_MS
    );
    run(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export async function probeVideo(file: Blob): Promise<ProbedVideo> {
  const previewUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = previewUrl;

  try {
    await once<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new VideoProbeError("That file couldn't be read as a video."));
    });

    const durationSeconds = video.duration;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new VideoProbeError("That file couldn't be read as a video.");
    }

    // Grab a poster frame for the placeholder. If seeking fails we still
    // have the duration — fall back to a flat placeholder.
    let blurDataUrl = "";
    try {
      await once<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new VideoProbeError("Couldn't read a frame."));
        video.currentTime = Math.min(POSTER_SEEK_SECONDS, durationSeconds / 2);
      });
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        blurDataUrl = placeholderFromSource(video, video.videoWidth, video.videoHeight);
      }
    } catch {
      // placeholder is cosmetic
    }
    if (!blurDataUrl) {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#1a1a3a";
        ctx.fillRect(0, 0, 16, 16);
      }
      blurDataUrl = canvas.toDataURL("image/jpeg", 0.5);
    }

    const ratio = video.videoWidth / video.videoHeight;
    return {
      durationMs: Math.round(durationSeconds * 1000),
      aspectRatio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1,
      blurDataUrl,
      previewUrl,
    };
  } catch (err) {
    URL.revokeObjectURL(previewUrl);
    throw err;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

/** `m:ss` for duration badges. */
export function formatDuration(durationMs: number): string {
  const total = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
