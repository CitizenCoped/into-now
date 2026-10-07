"use client";

/**
 * usePostMedia — client state for the media a new post will carry
 * (step 2 of PostCreateForm). Up to 4 items; videos (≤10s) count against
 * the 4 and are capped at 2.
 *
 * Upload flow per item (mirrors usePhotoLibrary, with `purpose: "post"`):
 *   photo: normalize (src/lib/imageNormalize.ts) → POST /api/photos →
 *          PUT /api/photos/[id]/content → POST /api/photos/[id]/scan
 *   video: probe (src/lib/videoProbe.ts) → same three calls with the raw
 *          clip and `kind: "video"`.
 * A failed upload/scan DELETEs the row so it never lingers as `scanning`.
 * Rejected items flash the danger tile briefly, then drop out.
 */

import {
  DM_PHOTO_NORMALIZE,
  decodeErrorMessage,
  normalizeImage,
  type NormalizedImage,
} from "@/lib/imageNormalize";
import type { MediaKind } from "@/lib/photoTypes";
import {
  MAX_POST_MEDIA,
  MAX_POST_VIDEO_SECONDS,
  MAX_POST_VIDEOS,
  MAX_VIDEO_BYTES,
} from "@/lib/photoTypes";
import { probeVideo, VideoProbeError } from "@/lib/videoProbe";
import { useCallback, useEffect, useRef, useState } from "react";

const REJECTED_TILE_MS = 1600;

export type PostMediaItem = {
  /** Server id once POST /api/photos returns; local key before that. */
  id: string;
  kind: MediaKind;
  blurDataUrl: string;
  /** Local object URL for the tile. */
  previewUrl: string;
  aspectRatio: number;
  durationMs: number | null;
  isLive: boolean;
  status: "scanning" | "ready" | "rejected";
};

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    // non-JSON body
  }
  return fallback;
}

export function usePostMedia() {
  const [items, setItems] = useState<PostMediaItem[]>([]);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Revoke every object URL on unmount.
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const patch = useCallback((id: string, next: Partial<PostMediaItem>) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...next } : m)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const discard = useCallback(
    (id: string, reason: "upload_failed" | "scan_failed") => {
      remove(id);
      const qs = new URLSearchParams({ reason });
      void fetch(`/api/photos/${id}?${qs}`, { method: "DELETE", keepalive: true }).catch(
        () => {}
      );
    },
    [remove]
  );

  /** Removes an already-uploaded item from the draft and from storage. */
  const removeItem = useCallback(
    (id: string) => {
      remove(id);
      void fetch(`/api/photos/${id}`, { method: "DELETE" }).catch(() => {});
    },
    [remove]
  );

  const photoCount = items.filter((m) => m.kind === "photo" && m.status !== "rejected").length;
  const videoCount = items.filter((m) => m.kind === "video" && m.status !== "rejected").length;
  const total = photoCount + videoCount;
  const slotsLeft = MAX_POST_MEDIA - total;
  const canAddVideo = slotsLeft > 0 && videoCount < MAX_POST_VIDEOS;

  const addFile = useCallback(
    async (file: Blob, isLive: boolean): Promise<string | null> => {
      setError("");
      if (preparingRef.current) return null;

      const current = itemsRef.current.filter((m) => m.status !== "rejected");
      if (current.length >= MAX_POST_MEDIA) {
        setError(`Up to ${MAX_POST_MEDIA} photos or videos per post.`);
        return null;
      }

      const kind: MediaKind = file.type.startsWith("video/") ? "video" : "photo";
      if (kind === "video" && current.filter((m) => m.kind === "video").length >= MAX_POST_VIDEOS) {
        setError(`Up to ${MAX_POST_VIDEOS} videos per post.`);
        return null;
      }

      // Prepare: normalize photos, probe videos.
      let blob: Blob;
      let blurDataUrl: string;
      let aspectRatio: number;
      let previewUrl: string;
      let durationMs: number | null = null;
      let contentType: string;

      preparingRef.current = true;
      setPreparing(true);
      try {
        if (kind === "video") {
          if (file.size > MAX_VIDEO_BYTES) {
            setError("That video is too large.");
            return null;
          }
          const probed = await probeVideo(file);
          if (probed.durationMs > MAX_POST_VIDEO_SECONDS * 1000) {
            URL.revokeObjectURL(probed.previewUrl);
            setError(`Videos must be ${MAX_POST_VIDEO_SECONDS} seconds or less`);
            return null;
          }
          blob = file;
          blurDataUrl = probed.blurDataUrl;
          aspectRatio = probed.aspectRatio;
          previewUrl = probed.previewUrl;
          durationMs = probed.durationMs;
          contentType = file.type || "video/mp4";
        } else {
          let normalized: NormalizedImage;
          try {
            normalized = await normalizeImage(file, DM_PHOTO_NORMALIZE);
          } catch (err) {
            setError(decodeErrorMessage(err));
            return null;
          }
          blob = normalized.blob;
          blurDataUrl = normalized.blurDataUrl;
          aspectRatio = normalized.aspectRatio;
          previewUrl = URL.createObjectURL(blob);
          contentType = blob.type || "image/jpeg";
        }
      } catch (err) {
        setError(
          err instanceof VideoProbeError ? err.message : "That file couldn't be read."
        );
        return null;
      } finally {
        preparingRef.current = false;
        setPreparing(false);
      }

      // Create the row, show the scanning tile, upload, scan.
      let photoId: string | undefined;
      try {
        const res = await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType,
            sizeBytes: blob.size,
            isLive,
            blurDataUrl,
            aspectRatio,
            kind,
            purpose: "post",
            durationMs: durationMs ?? undefined,
          }),
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, `Upload failed (${res.status}). Try again.`));
        }
        const data = (await res.json()) as { photoId?: string };
        photoId = data.photoId;
        if (!photoId) throw new Error("Upload failed.");

        setItems((prev) => [
          ...prev,
          {
            id: photoId!,
            kind,
            blurDataUrl,
            previewUrl,
            aspectRatio,
            durationMs,
            isLive,
            status: "scanning",
          },
        ]);

        const put = await fetch(`/api/photos/${photoId}/content`, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });
        if (!put.ok) {
          throw new Error(await readApiError(put, `Upload failed (${put.status}). Try again.`));
        }
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "Upload failed. Try again.");
        if (photoId) discard(photoId, "upload_failed");
        else URL.revokeObjectURL(previewUrl);
        return null;
      }

      try {
        const scan = await fetch(`/api/photos/${photoId}/scan`, { method: "POST" });
        const result = (await scan.json()) as { status?: string; error?: string };
        if (!scan.ok) throw new Error(result.error ?? "Scan failed");

        if (result.status === "rejected") {
          patch(photoId, { status: "rejected" });
          window.setTimeout(() => remove(photoId!), REJECTED_TILE_MS);
          return null;
        }

        patch(photoId, { status: "ready" });
        return photoId;
      } catch {
        setError("Screening failed. Try adding it again.");
        discard(photoId, "scan_failed");
        return null;
      }
    },
    [patch, remove, discard]
  );

  /** Ordered ids of items that can be attached (ready only). */
  const readyIds = items.filter((m) => m.status === "ready").map((m) => m.id);
  const busy = preparing || items.some((m) => m.status === "scanning");

  /** Drops every draft item from storage (user cancelled the post). */
  const discardAll = useCallback(() => {
    for (const item of itemsRef.current) {
      URL.revokeObjectURL(item.previewUrl);
      void fetch(`/api/photos/${item.id}`, { method: "DELETE", keepalive: true }).catch(
        () => {}
      );
    }
    setItems([]);
  }, []);

  return {
    items,
    error,
    preparing,
    busy,
    photoCount,
    videoCount,
    slotsLeft,
    canAddVideo,
    readyIds,
    addFile,
    removeItem,
    discardAll,
    clearError: () => setError(""),
  };
}
