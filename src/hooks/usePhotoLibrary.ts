"use client";

/**
 * usePhotoLibrary — client state for the reusable "My photos" library
 * (max 10) behind the composer PhotoSheet.
 *
 * Upload flow (see photo-feature-handoff-v3.md §3):
 *   1. generate blur placeholder + aspect ratio locally (src/lib/blur.ts)
 *   2. POST /api/photos → { photoId, uploadUrl } (row starts `scanning`)
 *   3. PUT the file directly to Spaces via the presigned URL
 *   4. POST /api/photos/[id]/scan → `ready` | `rejected`
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

import { generateBlurDataUrl, imageAspectRatio } from "@/lib/blur";
import type { LibraryPhoto } from "@/lib/photoTypes";
import { MAX_LIBRARY_PHOTOS, MAX_PHOTO_BYTES } from "@/lib/photoTypes";
import { useCallback, useEffect, useRef, useState } from "react";

/** How long the danger tile stays visible before a rejected photo is
 *  removed from the grid. */
const REJECTED_TILE_MS = 1600;

export function usePhotoLibrary(enabled: boolean) {
  const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
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

  /** Upload a photo file into the library. Returns the new photoId, or
   *  null if the upload never started (validation) or was rejected. */
  const uploadPhoto = useCallback(
    async (file: Blob, isLive: boolean): Promise<string | null> => {
      setError("");

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Photos must be JPEG, PNG, or WebP.");
        return null;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError("Photos must be under 5MB.");
        return null;
      }
      if (photos.filter((p) => p.status !== "rejected").length >= MAX_LIBRARY_PHOTOS) {
        setError(`Library is full (${MAX_LIBRARY_PHOTOS} photos max).`);
        return null;
      }

      let blurDataUrl: string;
      let aspectRatio: number;
      try {
        [blurDataUrl, aspectRatio] = await Promise.all([
          generateBlurDataUrl(file),
          imageAspectRatio(file),
        ]);
      } catch {
        setError("That file couldn't be read as an image.");
        return null;
      }

      let photoId: string;
      try {
        const res = await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: file.type,
            sizeBytes: file.size,
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
        photoId = data.photoId;

        // Tile appears immediately in the scanning state; the sweep runs
        // for the real upload + moderation duration.
        const previewUrl = URL.createObjectURL(file);
        setPreviewUrls((prev) => ({ ...prev, [photoId]: previewUrl }));
        setPhotos((prev) => [
          ...prev,
          { id: photoId, blurDataUrl, aspectRatio, isLive, status: "scanning" },
        ]);

        const put = await fetch(data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      } catch {
        setError("Upload failed. Check your connection and try again.");
        if (photoId!) removePhoto(photoId!);
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
          window.setTimeout(() => removePhoto(photoId), REJECTED_TILE_MS);
          return null;
        }

        patchPhoto(photoId, { status: "ready" });
        return photoId;
      } catch {
        setError("Scan failed. Try uploading again.");
        removePhoto(photoId);
        return null;
      }
    },
    [photos, patchPhoto, removePhoto]
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
    clearError: () => setError(""),
    fetchLibrary,
    uploadPhoto,
    deletePhoto,
  };
}
