/**
 * Sightengine image moderation — sync REST check at upload time.
 *
 * Called from POST /api/photos/[id]/scan with a short-lived presigned GET
 * URL for the just-uploaded object. Rejects when any watched class scores
 * at or above the threshold (start conservative: 0.6).
 *
 * Env: SIGHTENGINE_USER / SIGHTENGINE_SECRET. While the vendor account is
 * pending, both are unset and scans PASS with `skipped: true` — the scan
 * tile still animates for real request latency, per the handoff spec
 * ("while sync moderation is pending integration, animate 100–500ms").
 *
 * NOTE (pre-public-launch requirement, see handoff §5): layer in
 * NCMEC/CSAM hash-matching (PhotoDNA or Cloudflare CSAM tool) before any
 * public launch. Sightengine classification alone is not sufficient for
 * this app category.
 */

const SIGHTENGINE_ENDPOINT = "https://api.sightengine.com/1.0/check.json";

/** Reject when any watched class scores >= this. */
const REJECT_THRESHOLD = 0.6;

/** Model set: nudity / minor / gore classes per the handoff spec.
 *  Overridable without a deploy via SIGHTENGINE_MODELS. */
const DEFAULT_MODELS = "nudity-2.1,gore-2.0,offensive";

/** Response keys whose numeric leaves are safety scores we act on. Keys
 *  expressing "none of the above" are skipped so a clean image (e.g.
 *  nudity.none = 0.99) never trips the threshold. */
const WATCHED_ROOTS = new Set(["nudity", "gore", "offensive", "type", "faces", "minor"]);
const SAFE_LEAF_KEYS = new Set(["none", "safe", "context"]);

export type ModerationResult = {
  ok: boolean;
  /** true when Sightengine creds are absent and the scan was a no-op. */
  skipped: boolean;
  /** Highest watched score, for activity logging. */
  topScore: number;
  /** Dot-path of the highest watched score, e.g. "nudity.sexual_activity". */
  topClass: string | null;
};

export function isModerationConfigured(): boolean {
  return Boolean(process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET);
}

function collectScores(
  node: unknown,
  path: string,
  out: { path: string; score: number }[]
) {
  if (typeof node === "number") {
    const leaf = path.split(".").pop() ?? "";
    if (!SAFE_LEAF_KEYS.has(leaf)) out.push({ path, score: node });
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectScores(item, path, out);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "id" || key === "x1" || key === "x2" || key === "y1" || key === "y2") continue;
      collectScores(value, path ? `${path}.${key}` : key, out);
    }
  }
}

/**
 * Scan an image (via URL Sightengine can fetch) and decide pass/reject.
 * Throws on network/API failure so the caller can leave the photo in
 * `scanning` rather than silently approving it.
 */
export async function scanImageUrl(imageUrl: string): Promise<ModerationResult> {
  if (!isModerationConfigured()) {
    console.warn("moderation: SIGHTENGINE_USER/SECRET not set — scan skipped (photo passes)");
    return { ok: true, skipped: true, topScore: 0, topClass: null };
  }

  const params = new URLSearchParams({
    url: imageUrl,
    models: process.env.SIGHTENGINE_MODELS ?? DEFAULT_MODELS,
    api_user: process.env.SIGHTENGINE_USER!,
    api_secret: process.env.SIGHTENGINE_SECRET!,
  });

  const res = await fetch(`${SIGHTENGINE_ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Sightengine HTTP ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  if (data.status !== "success") {
    throw new Error(`Sightengine error: ${JSON.stringify(data.error ?? data.status)}`);
  }

  const scores: { path: string; score: number }[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (WATCHED_ROOTS.has(key)) collectScores(value, key, scores);
  }

  let top = { path: null as string | null, score: 0 };
  for (const entry of scores) {
    if (entry.score > top.score) top = { path: entry.path, score: entry.score };
  }

  return {
    ok: top.score < REJECT_THRESHOLD,
    skipped: false,
    topScore: top.score,
    topClass: top.path,
  };
}
