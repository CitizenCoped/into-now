/**
 * Sightengine image moderation — sync REST check at upload time.
 *
 * Called from POST /api/photos/[id]/scan with a short-lived presigned GET
 * URL for the just-uploaded object. Rejects when any WATCHED_PATHS score is
 * at or above REJECT_THRESHOLD (0.6).
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

/** Reject when any watched score is >= this. */
const REJECT_THRESHOLD = 0.6;

/** Model set: nudity / gore / offensive per the handoff spec.
 *  Overridable without a deploy via SIGHTENGINE_MODELS. */
const DEFAULT_MODELS = "nudity-2.1,gore-2.0,offensive";

/**
 * The aggregate safety scores we act on, as dot-paths into the Sightengine
 * response. This is an explicit allowlist on purpose: the response also
 * carries *descriptors* that read as high-confidence but are not safety
 * signals — `nudity.context.indoor_other` (scene: indoors), `gore.type.real`
 * (it's a real photo, not a drawing), `nudity.suggestive_classes.*` (fine-
 * grained breakdown of the suggestive tiers). A blanket "reject any leaf
 * >= threshold" rule rejected every indoor selfie on those. Suggestive tiers
 * (`very_suggestive`, `suggestive`, `mildly_suggestive`) are deliberately
 * not watched — swimwear/beach/cleavage photos are fine for this product.
 *
 * Response shape reference (nudity-2.1 / gore-2.0 / offensive), 2026-09:
 *   nudity: { sexual_activity, sexual_display, erotica, very_suggestive,
 *             suggestive, mildly_suggestive, none, suggestive_classes{…},
 *             context{ sea_lake_pool, outdoor_other, indoor_other } }
 *   gore:   { prob, classes{…}, type{ animated, fake, real } }
 *   offensive: { prob, nazi, confederate, supremacist, terrorist, middle_finger }
 */
const WATCHED_PATHS = [
  "nudity.sexual_activity",
  "nudity.sexual_display",
  "nudity.erotica",
  "gore.prob",
  "offensive.prob",
] as const;

export type ModerationResult = {
  ok: boolean;
  /** true when Sightengine creds are absent and the scan was a no-op. */
  skipped: boolean;
  /** Highest watched score, for activity logging. */
  topScore: number;
  /** Dot-path of the highest watched score, e.g. "nudity.sexual_activity". */
  topClass: string | null;
  /** Every watched score, for activity logging / threshold tuning. */
  scores: Partial<Record<(typeof WATCHED_PATHS)[number], number>>;
};

export function isModerationConfigured(): boolean {
  return Boolean(process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET);
}

/** Read a numeric leaf at a dot-path; undefined if absent or non-numeric. */
function scoreAt(data: Record<string, unknown>, path: string): number | undefined {
  let node: unknown = data;
  for (const key of path.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === "number" ? node : undefined;
}

/**
 * Scan an image (via URL Sightengine can fetch) and decide pass/reject.
 * Throws on network/API failure so the caller can leave the photo in
 * `scanning` rather than silently approving it.
 */
export async function scanImageUrl(imageUrl: string): Promise<ModerationResult> {
  if (!isModerationConfigured()) {
    console.warn("moderation: SIGHTENGINE_USER/SECRET not set — scan skipped (photo passes)");
    return { ok: true, skipped: true, topScore: 0, topClass: null, scores: {} };
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

  const scores: ModerationResult["scores"] = {};
  let top: { path: string | null; score: number } = { path: null, score: 0 };
  for (const path of WATCHED_PATHS) {
    const score = scoreAt(data, path);
    if (score === undefined) continue;
    scores[path] = score;
    if (score > top.score) top = { path, score };
  }

  return {
    ok: top.score < REJECT_THRESHOLD,
    skipped: false,
    topScore: top.score,
    topClass: top.path,
    scores,
  };
}
