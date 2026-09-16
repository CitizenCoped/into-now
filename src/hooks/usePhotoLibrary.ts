"use client";

/**
 * usePhotoLibrary — client state for the reusable "My photos" library
 * (max 10) behind the composer PhotoSheet.
 *
 * Upload flow:
 *   1. normalize locally (src/lib/imageNormalize.ts)
 *   2. POST /api/photos → { photoId } (row starts `scanning`)
 *   3. PUT /api/photos/[id]/content — same-origin, so Spaces CORS is not required
 *   4. POST /api/photos/[id]/scan → `ready` | `rejected`
 *   On failure at 3 or 4 the row is DELETEd (with a reason) so it neither
 *   lingers as a `scanning` orphan nor counts toward the library cap.
 */

import {
  DM_PHOTO_NORMALIZE,
  decodeErrorMessage,
  normalizeImage,
  type NormalizedImage,
} from "@/lib/imageNormalize";
import type { LibraryPhoto } from "@/lib/photoTypes";
import { LIBRARY_SLOT_STATUSES, MAX_LIBRARY_PHOTOS } from "@/lib/photoTypes";
import { useCallback, useEffect, useRef, useState } from "react";

const REJECTED_TILE_MS = 1600;

class UploadHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UploadHttpError";
    this.status = status;
  }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    // non-JSON body
  }
  return fallback;
}

function uploadErrorMessage(err: unknown): string {
  if (err instanceof UploadHttpError) {
    if (err.status === 401) return "Sign in again to send photos.";
    if (err.status === 413) return "Photo is too large.";
    return err.message || `Upload failed (${err.status}). Try again.`;
  }
  return "Upload failed. Check your connection and try again.";
}

export function usePhotoLibrary(enabled: boolean) {
  const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
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

  const uploadPhoto = useCallback(
    async (file: Blob, isLive: boolean): Promise<string | null> => {
      setError("");

      if (preparingRef.current) return null;

      const usedSlots = photos.filter((p) =>
        (LIBRARY_SLOT_STATUSES as readonly string[]).includes(p.status)
      ).length;
      if (usedSlots >= MAX_LIBRARY_PHOTOS) {
        setError(`Library is full (${MAX_LIBRARY_PHOTOS} photos max).`);
        return null;
      }

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
        if (!res.ok) {
          throw new UploadHttpError(
            res.status,
            await readApiError(res, `Upload failed (${res.status}). Try again.`)
          );
        }
        const data = (await res.json()) as { photoId?: string };
        photoId = data.photoId;
        if (!photoId) throw new UploadHttpError(res.status, "Upload failed.");

        const previewUrl = URL.createObjectURL(blob);
        setPreviewUrls((prev) => ({ ...prev, [photoId!]: previewUrl }));
        setPhotos((prev) => [
          ...prev,
          { id: photoId!, blurDataUrl, aspectRatio, isLive, status: "scanning" },
        ]);

        const put = await fetch(`/api/photos/${photoId}/content`, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });
        if (!put.ok) {
          throw new UploadHttpError(
            put.status,
            await readApiError(put, `Upload failed (${put.status}). Try again.`)
          );
        }
      } catch (err) {
        setError(uploadErrorMessage(err));
        if (photoId) {
          discardPhoto(
            photoId,
            "upload_failed",
            err instanceof UploadHttpError ? err.status : undefined
          );
        }
        return null;
      }

      try {
        const scan = await fetch(`/api/photos/${photoId}/scan`, { method: "POST" });
        const result = (await scan.json()) as { status?: string; error?: string };
        if (!scan.ok) throw new Error(result.error ?? "Scan failed");

        if (result.status === "rejected") {
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
