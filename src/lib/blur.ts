/**
 * Blur-placeholder generation for the photo blur-to-reveal feature.
 *
 * FEATURE-FLAGGED OFF — see src/lib/flags.ts (FEATURES.photoBlur).
 *
 * Privacy model: the tiny placeholder produced here is the ONLY image data
 * that ever reaches unrevealed viewers. The full-resolution URL must never
 * be sent to a client that hasn't been granted a reveal — blurring the real
 * image with CSS would leave the raw URL in the DOM for anyone to lift.
 * Enforce reveals server-side; treat this placeholder as the public asset.
 *
 * Runs in the browser at upload time (canvas API), so no server image
 * library (sharp etc.) is needed. Call generateBlurDataUrl() right before
 * the @vercel/blob client upload and store the result alongside the photo
 * row (post_photos.blur_data_url — see migration 0003 in the pivot plan).
 */

/** Longest edge of the placeholder, in pixels. Small enough that the
 *  upscaled render is pure color-field — shape and mood, zero detail. */
const PLACEHOLDER_MAX_EDGE = 16;

/** JPEG quality for the placeholder. Output is ~200–400 bytes. */
const PLACEHOLDER_QUALITY = 0.5;

/**
 * Downscale an image file to a tiny base64 JPEG data URL suitable for a
 * blurred placeholder render.
 *
 * @throws if the file cannot be decoded as an image or canvas is unavailable.
 */
export async function generateBlurDataUrl(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = PLACEHOLDER_MAX_EDGE / Math.max(bitmap.width, bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", PLACEHOLDER_QUALITY);
  } finally {
    bitmap.close();
  }
}

/**
 * Aspect ratio (width / height) of an image file, for reserving layout
 * space before the placeholder loads. Falls back to 1 on decode failure.
 */
export async function imageAspectRatio(file: Blob): Promise<number> {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width / bitmap.height;
    bitmap.close();
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  } catch {
    return 1;
  }
}
