"use client";

/**
 * usePhotoLibrary — client state for the reusable "My photos" library
 * (max 10) behind the composer PhotoSheet.
 *
 * Upload flow (see photo-feature-handoff-v3.md §3):
 *   1. normalize locally (src/lib/imageNormalize.ts): decode anything the
 *      phone produced (HEIC, 12MB JPEG, …), downscale, re-encode as JPEG,
 *      and get the blur placeholder + aspect ratio from that same decode.
 *      `preparing` is true for this step — no tile exists yet.
 *   2. POST /api/photos → { photoId, uploadUrl } (row starts `scanning`)
 *   3. PUT the normalized blob directly to Spaces via the presigned URL.
 *      Content-Length is part of the signature, so the exact blob whose
 *      size we declared is the one we send.
 *   4. POST /api/photos/[id]/scan → `ready` | `rejected`
 *   On failure at 3 or 4 the row is DELETEd (with a reason) so it neither
 *   lingers as a `scanning` orphan nor counts toward the library cap.
 *
 * While a photo is `scanning` the tile shows the silent sweep animation —
 * its duration is the real upload+moderation latency, never a fixed timer.
 * A `rejected` photo shows the danger tile briefly, then disappears; the
 * server has already deleted the object.
 *
 * `previewUrls` maps photoId → local object URL for photos uploaded this
 * session, so the sheet can show them sharp; otherwise tiles render the
 * blur placeholder (the API never returns real URLs for the library).
 */

import {
  DM_PHOTO_NORMALIZE,
  decodeErrorMessage,
  normalizeImage,
  type NormalizedImage,
} from "@/lib/imageNormalize";
import type { LibraryPhoto } from "@/lib/photoTypes";
import { MAX_LIBRARY_PHOTOS } from "@/lib/photoTypes";
import { useCallback, useEffect, useRef, useState } from "react";

/** How long the danger tile stays visible before a rejected photo is
 *  removed from the grid. */
const REJECTED_TILE_MS = 1600;

/** A non-2xx response from the presigned PUT to Spaces. */
class UploadPutError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Upload failed (${status})`);
    this.name = "UploadPutError";
    this.status = status;
  }
}

function uploadErrorMessage(err: unknown): string {
  if (err instanceof UploadPutError) {
    // 403 = signature mismatch or expired presign; 413 = over the signed
    // Content-Length (shouldn't happen — we declare the exact blob size).
    if (err.status === 403) return "Upload link expired. Try again.";
    if (err.status === 413) return "Photo is too large.";
    return `Upload failed (${err.status}). Try again.`;
  }
  // fetch() rejects with a TypeError on network drop or CORS preflight
  // failure — indistinguishable from the client, so keep the copy generic.
  return "Upload failed. Check your connection and try again.";
}

export function usePhotoLibrary(enabled: boolean) {
  const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  /** True while a picked file is being decoded/resized, before any tile. */
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);
  const previewUrlsRef = useRef(previewUrls);
  previewUrlsRef.current = previewUrls;

  const fetchLibrary = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/photos");
      if (!res.ok) return;
      const data = await res.json();
      setPhotos((prev) => {
        const fetched: LibraryPhoto[] = data.photos ?? [];
        // Keep any in-flight local uploads that the server list doesn't
        // know about yet (row exists but we're mid-PUT/scan).
        const inFlight = prev.filter(
          (p) => p.status === "scanning" && !fetched.some((f) => f.id === p.id)
        );
        return [...fetched, ...inFlight];
      });
    } catch {
      // library just stays stale; next open refetches
    }
  }, [enabled]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Revoke local object URLs on unmount.
  useEffect(() => {
    return () => {
      for (const url of Object.values(previewUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const patchPhoto = useCallback((id: string, patch: Partial<LibraryPhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setPreviewUrls((prev) => {
      if (!prev[id]) return prev;
      URL.revokeObjectURL(prev[id]);
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  /** Drop a row whose upload or scan never completed. Local removal is
   *  immediate; the server DELETE is best-effort and logs the reason as
   *  `photo.upload_failed` so failures are visible in the activity feed. */
  const discardPhoto = useCallback(
    (id: string, reason: "upload_failed" | "scan_failed", status?: number) => {
      removePhoto(id);
      const qs = new URLSearchParams({ reason, status: String(status ?? 0) });
      void fetch(`/api/photos/${id}?${qs}`, { method: "DELETE", keepalive: true }).catch(
        () => {}
      );
    },
    [removePhoto]
  );

  /** Upload a photo file into the library. Returns the new photoId, or
   *  null if the upload never started (validation) or was rejected. */
  const uploadPhoto = useCallback(
    async (file: Blob, isLive: boolean): Promise<string | null> => {
      setError("");

      // Guard against a second pick while the first is still decoding.
      if (preparingRef.current) return null;

      if (photos.filter((p) => p.status !== "rejected").length >= MAX_LIBRARY_PHOTOS) {
        setError(`Library is full (${MAX_LIBRARY_PHOTOS} photos max).`);
        return null;
      }

      // Normalize first: this is what turns a HEIC or a 12MB camera JPEG
      // into something every later step accepts.
      let normalized: NormalizedImage;
      preparingRef.current = true;
      setPreparing(true);
      try {
        normalized = await normalizeImage(file, DM_PHOTO_NORMALIZE);
      } catch (err) {
        setError(decodeErrorMessage(err));
        return null;
      } finally {
        preparingRef.current = false;
        setPreparing(false);
      }
      const { blob, blurDataUrl, aspectRatio } = normalized;
      const contentType = blob.type || "image/jpeg";

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
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Upload failed.");
          return null;
        }
        photoId = data.photoId as string;

        // Tile appears immediately in the scanning state; the sweep runs
        // for the real upload + moderation duration.
        const previewUrl = URL.createObjectURL(blob);
        setPreviewUrls((prev) => ({ ...prev, [photoId!]: previewUrl }));
        setPhotos((prev) => [
          ...prev,
          { id: photoId!, blurDataUrl, aspectRatio, isLive, status: "scanning" },
        ]);

        const put = await fetch(data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });
        if (!put.ok) throw new UploadPutError(put.status);
      } catch (err) {
        setError(uploadErrorMessage(err));
        if (photoId) {
          discardPhoto(
            photoId,
            "upload_failed",
            err instanceof UploadPutError ? err.status : undefined
          );
        }
        return null;
      }

      try {
        const scan = await fetch(`/api/photos/${photoId}/scan`, { method: "POST" });
        const result = await scan.json();
        if (!scan.ok) throw new Error(result.error ?? "Scan failed");

        if (result.status === "rejected") {
          // Danger tile flashes briefly, then the photo is gone — the
          // object was already deleted server-side.
          patchPhoto(photoId, { status: "rejected" });
          window.setTimeout(() => removePhoto(photoId!), REJECTED_TILE_MS);
          return null;
        }

        patchPhoto(photoId, { status: "ready" });
        return photoId;
      } catch {
        setError("Scan failed. Try uploading again.");
        discardPhoto(photoId, "scan_failed");
        return null;
      }
    },
    [photos, patchPhoto, removePhoto, discardPhoto]
  );

  /** Remove a photo from the library (and Spaces, server-side). */
  const deletePhoto = useCallback(
    async (id: string) => {
      removePhoto(id);
      try {
        await fetch(`/api/photos/${id}`, { method: "DELETE" });
      } catch {
        fetchLibrary();
      }
    },
    [removePhoto, fetchLibrary]
  );

  return {
    photos,
    previewUrls,
    error,
    preparing,
    clearError: () => setError(""),
    fetchLibrary,
    uploadPhoto,
    deletePhoto,
  };
}
