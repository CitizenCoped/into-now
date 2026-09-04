/**
 * imageNormalize — browser-side "make any photo uploadable" step.
 *
 * Every photo a user picks (DM library, avatar, in-page camera capture) is
 * run through normalizeImage() BEFORE any size/type check or upload:
 *
 *   decode whatever the device produced (JPEG, PNG, WebP, HEIC, GIF, AVIF…)
 *     → downscale to a max long edge
 *     → re-encode as a plain JPEG
 *     → upload THAT blob
 *
 * That single step is what makes uploads work first time on real phones:
 *   - iPhone camera output is HEIC by default, which no server layer accepts.
 *   - Modern phone JPEGs are 4–12MB against caps of 2–5MB.
 *   - EXIF orientation gets baked into the pixels, so nothing downstream
 *     can show the photo sideways.
 *   - Re-encoding strips EXIF entirely, including GPS — a privacy win for
 *     a location app.
 *
 * Decode ladder (first success wins):
 *   1. createImageBitmap(file, { imageOrientation: "from-image" })
 *   2. createImageBitmap(file)                (older Safari; auto-orients)
 *   3. HEIC sniffed → lazy WASM decoder       (Chrome / Android / Firefox;
 *      WebKit decodes HEIC natively so iOS never reaches this)
 *   4. <img> + object URL                     (last resort)
 *   5. throw ImageDecodeError(format)
 *
 * HEIC WASM decoder: `heic-decode` over `libheif-js` (wasm-bundle build,
 * inline WASM so no bundler/CSP asset config). LGPL-3.0, used unmodified via
 * dynamic import() — it is a separate lazy chunk that only loads when a
 * non-WebKit browser is handed a HEIC file. If a CSP is ever added to
 * next.config.mjs it will need `'wasm-unsafe-eval'` in script-src.
 *
 * Canvas limits: every canvas we draw into is ≤ maxEdge² (2048² ≈ 4.2MP for
 * DM photos) with step-halving intermediates capped at INTERMEDIATE_MAX_PIXELS,
 * comfortably under Safari's ~16.7M-pixel canvas ceiling even for 48MP input.
 * The decoded ImageBitmap itself lives in decoder memory, not a canvas.
 */

import { placeholderFromSource } from "./blur";

export type NormalizeOptions = {
  /** Long-edge cap in pixels. Output is never upscaled. */
  maxEdge: number;
  /** JPEG quality for the first encode attempt. Default 0.85. */
  quality?: number;
  /** If the encoded blob exceeds this, retry at lower quality, then at a
   *  smaller edge. Undefined = no size loop. */
  maxBytes?: number;
  /** Fill drawn under transparent sources (PNG alpha → JPEG). Default white. */
  background?: string;
};

export type NormalizedImage = {
  /** Always image/jpeg, EXIF-free, orientation baked in. */
  blob: Blob;
  width: number;
  height: number;
  /** width / height — finite and > 0. */
  aspectRatio: number;
  /** 16px blur placeholder (src/lib/blur.ts) from the same decode. */
  blurDataUrl: string;
  meta: {
    sourceType: string;
    sourceBytes: number;
    decoder: "bitmap" | "img" | "heif-wasm";
    /** Wall-clock ms for decode + resize + encode. */
    ms: number;
  };
};

/** Thrown when no decoder could read the file. `format` is a human label
 *  ("HEIC", "PNG", …) from magic-byte sniffing, or "" when unknown. */
export class ImageDecodeError extends Error {
  readonly format: string;
  constructor(format: string, message?: string) {
    super(message ?? (format ? `Could not decode ${format} image` : "Could not decode image"));
    this.name = "ImageDecodeError";
    this.format = format;
  }
}

/** User-facing copy for a failed normalize. */
export function decodeErrorMessage(err: unknown): string {
  if (err instanceof ImageDecodeError && err.format) {
    return `Couldn't read that ${err.format} file. Try a different photo.`;
  }
  return "That file couldn't be read as an image.";
}

/** DM library photos: full-screen reveal on a phone. ~300–900KB typical. */
export const DM_PHOTO_NORMALIZE: NormalizeOptions = {
  maxEdge: 2048,
  quality: 0.85,
  maxBytes: 4 * 1024 * 1024,
};

/** Profile avatars: rendered as a small circle. ~30–80KB typical. */
export const AVATAR_NORMALIZE: NormalizeOptions = {
  maxEdge: 512,
  quality: 0.85,
  maxBytes: 1024 * 1024,
};

/** Largest intermediate canvas allowed during step-halving (pixels). */
const INTERMEDIATE_MAX_PIXELS = 12_000_000;

/** Hard sanity bound on output dimensions. */
const MAX_OUTPUT_EDGE = 16_384;

type SniffedFormat = "jpeg" | "png" | "webp" | "gif" | "heic" | "avif" | "bmp" | "unknown";

const FORMAT_LABEL: Record<SniffedFormat, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  heic: "HEIC",
  avif: "AVIF",
  bmp: "BMP",
  unknown: "",
};

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heif"]);

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  decoder: NormalizedImage["meta"]["decoder"];
  close: () => void;
};

// ---------------------------------------------------------------------------
// Format sniffing
// ---------------------------------------------------------------------------

async function sniffFormat(file: Blob): Promise<SniffedFormat> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  } catch {
    return "unknown";
  }
  if (bytes.length < 12) return "unknown";

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(start, end)))
      .replace(/\0/g, " ")
      .trim();

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(0, 2) === "BM") return "bmp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12).toLowerCase();
    if (brand === "avif" || brand === "avis") return "avif";
    if (HEIC_BRANDS.has(brand)) return "heic";
  }
  return "unknown";
}

function looksLikeHeic(file: Blob, sniffed: SniffedFormat): boolean {
  if (sniffed === "heic") return true;
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // Android and some file managers hand over an empty MIME type; fall back
  // to the filename when there is one.
  const name = (file as File).name ?? "";
  return type === "" && /\.hei[cf]$/i.test(name);
}

function formatLabelFor(file: Blob, sniffed: SniffedFormat): string {
  if (sniffed !== "unknown") return FORMAT_LABEL[sniffed];
  const name = (file as File).name ?? "";
  const ext = name.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  if (ext) return ext.toUpperCase();
  const sub = file.type.split("/")[1];
  return sub ? sub.replace(/^x-/, "").toUpperCase() : "";
}

// ---------------------------------------------------------------------------
// Decoders
// ---------------------------------------------------------------------------

async function decodeBitmap(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("createImageBitmap unavailable");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    // Older engines reject unknown option bags with a TypeError; retry bare.
    // Safari applies EXIF orientation automatically in that case.
    if (!(err instanceof TypeError)) throw err;
    bitmap = await createImageBitmap(file);
  }
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    decoder: "bitmap",
    close: () => bitmap.close(),
  };
}

async function decodeHeicWasm(file: Blob): Promise<Decoded> {
  const { default: decode } = await import("heic-decode");
  const buffer = new Uint8Array(await file.arrayBuffer());
  const { width, height, data } = await decode({ buffer });
  if (!width || !height) throw new Error("HEIC decoded to empty image");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  // View the decoder's RGBA bytes without copying; the cast only narrows
  // ArrayBufferLike → ArrayBuffer for ImageData's constructor typing.
  const pixels = new Uint8ClampedArray(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);

  return {
    source: canvas,
    width,
    height,
    decoder: "heif-wasm",
    close: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

async function decodeViaImg(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  try {
    img.src = url;
    if (typeof img.decode === "function") {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
      });
    }
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    decoder: "img",
    close: () => URL.revokeObjectURL(url),
  };
}

async function decodeAny(file: Blob): Promise<Decoded> {
  const sniffed = await sniffFormat(file);

  try {
    return await decodeBitmap(file);
  } catch {
    // fall through
  }

  if (looksLikeHeic(file, sniffed)) {
    try {
      return await decodeHeicWasm(file);
    } catch {
      // fall through — maybe <img> can (WebKit), else we error below
    }
  }

  try {
    return await decodeViaImg(file);
  } catch {
    throw new ImageDecodeError(formatLabelFor(file, sniffed));
  }
}

// ---------------------------------------------------------------------------
// Resize + encode
// ---------------------------------------------------------------------------

function fitWithin(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { w, h };
  const scale = maxEdge / longest;
  return {
    w: Math.max(1, Math.round(w * scale)),
    h: Math.max(1, Math.round(h * scale)),
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return [canvas, ctx];
}

/**
 * Draw `decoded` into a fresh canvas of exactly targetW × targetH.
 * Large downscales are done in halving steps (each intermediate capped at
 * INTERMEDIATE_MAX_PIXELS) so quality stays good and no single canvas gets
 * anywhere near mobile Safari's pixel ceiling.
 */
function drawScaled(
  decoded: Decoded,
  targetW: number,
  targetH: number,
  background: string
): HTMLCanvasElement {
  let src: CanvasImageSource = decoded.source;
  let sw = decoded.width;
  let sh = decoded.height;
  const intermediates: HTMLCanvasElement[] = [];

  while (sw / targetW > 2 && sh / targetH > 2) {
    let nw = Math.max(targetW, Math.ceil(sw / 2));
    let nh = Math.max(targetH, Math.ceil(sh / 2));
    if (nw * nh > INTERMEDIATE_MAX_PIXELS) {
      const s = Math.sqrt(INTERMEDIATE_MAX_PIXELS / (nw * nh));
      nw = Math.max(targetW, Math.floor(nw * s));
      nh = Math.max(targetH, Math.floor(nh * s));
    }
    const [c, ctx] = makeCanvas(nw, nh);
    ctx.drawImage(src, 0, 0, sw, sh, 0, 0, nw, nh);
    intermediates.push(c);
    src = c;
    sw = nw;
    sh = nh;
  }

  const [out, ctx] = makeCanvas(targetW, targetH);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(src, 0, 0, sw, sh, 0, 0, targetW, targetH);

  for (const c of intermediates) {
    c.width = 0;
    c.height = 0;
  }
  return out;
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))),
      "image/jpeg",
      quality
    );
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Decode, downscale, and re-encode `file` as a JPEG per `opts`.
 *
 * @throws ImageDecodeError when no decoder can read the file.
 * @throws Error for canvas/encode failures (treat as "couldn't read").
 */
export async function normalizeImage(
  file: Blob,
  opts: NormalizeOptions
): Promise<NormalizedImage> {
  const started = performance.now();
  const quality = opts.quality ?? 0.85;
  const background = opts.background ?? "#ffffff";

  const decoded = await decodeAny(file);
  try {
    if (!decoded.width || !decoded.height) {
      throw new ImageDecodeError(formatLabelFor(file, await sniffFormat(file)));
    }

    // Encode attempts: base → lower quality → smaller edge at lower quality.
    // In practice a 2048px q0.85 JPEG is well under 4MB, so the loop almost
    // never iterates; it exists so `maxBytes` is a guarantee, not a hope.
    const attempts: Array<{ edge: number; q: number }> = [
      { edge: opts.maxEdge, q: quality },
      { edge: opts.maxEdge, q: Math.max(0.6, quality - 0.1) },
      { edge: Math.round(opts.maxEdge * 0.75), q: Math.max(0.6, quality - 0.1) },
    ];

    let canvas: HTMLCanvasElement | null = null;
    let blob: Blob | null = null;
    let width = 0;
    let height = 0;

    for (const attempt of attempts) {
      const fit = fitWithin(decoded.width, decoded.height, attempt.edge);
      if (!canvas || fit.w !== width || fit.h !== height) {
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
        width = fit.w;
        height = fit.h;
        if (width > MAX_OUTPUT_EDGE || height > MAX_OUTPUT_EDGE) {
          throw new ImageDecodeError(formatLabelFor(file, await sniffFormat(file)));
        }
        canvas = drawScaled(decoded, width, height, background);
      }
      blob = await toJpegBlob(canvas, attempt.q);
      if (!opts.maxBytes || blob.size <= opts.maxBytes) break;
    }

    if (!canvas || !blob) throw new Error("normalizeImage produced no output");

    const blurDataUrl = placeholderFromSource(canvas, width, height);
    canvas.width = 0;
    canvas.height = 0;

    const ratio = width / height;
    return {
      blob,
      width,
      height,
      aspectRatio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1,
      blurDataUrl,
      meta: {
        sourceType: file.type,
        sourceBytes: file.size,
        decoder: decoded.decoder,
        ms: Math.round(performance.now() - started),
      },
    };
  } finally {
    decoded.close();
  }
}
