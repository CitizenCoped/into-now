/**
 * Sightengine image moderation — sync REST check at upload time.
 *
 * Called from POST /api/photos/[id]/scan with a short-lived presigned GET
 * URL for the just-uploaded object. Rejects when any enabled catalog
 * class scores at or above that class's threshold (DB-backed, cached).
 *
 * Env: SIGHTENGINE_USER / SIGHTENGINE_SECRET. While both are unset,
 * scans PASS with `skipped: true`.
 *
 * NOTE (pre-public-launch requirement, see handoff §5): layer in
 * NCMEC/CSAM hash-matching (PhotoDNA or Cloudflare CSAM tool) before any
 * public launch. Sightengine classification alone is not sufficient for
 * this app category.
 */

import {
  collectCatalogScores,
  decide,
  type Decision,
  type ModerationClassPath,
  type TriggeredClass,
} from "@/lib/moderationCatalog";
import { getModerationSettings } from "@/lib/moderationSettings";

const SIGHTENGINE_ENDPOINT = "https://api.sightengine.com/1.0/check.json";
const DEFAULT_MODELS = "nudity-2.1,gore-2.0,offensive";

export type ModerationResult = {
  ok: boolean;
  skipped: boolean;
  topScore: number;
  topClass: ModerationClassPath | null;
  scores: Partial<Record<ModerationClassPath, number>>;
  triggered: TriggeredClass[];
  raw: Record<string, unknown> | null;
};

export function isModerationConfigured(): boolean {
  return Boolean(process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET);
}

function credentials() {
  const apiUser = process.env.SIGHTENGINE_USER;
  const apiSecret = process.env.SIGHTENGINE_SECRET;
  if (!apiUser || !apiSecret) {
    throw new Error("Sightengine is not configured");
  }
  return {
    apiUser,
    apiSecret,
    models: process.env.SIGHTENGINE_MODELS ?? DEFAULT_MODELS,
  };
}

export async function fetchSightengineByUrl(imageUrl: string): Promise<Record<string, unknown>> {
  const { apiUser, apiSecret, models } = credentials();
  const params = new URLSearchParams({
    url: imageUrl,
    models,
    api_user: apiUser,
    api_secret: apiSecret,
  });
  const res = await fetch(`${SIGHTENGINE_ENDPOINT}?${params.toString()}`);
  return parseSightengineResponse(res);
}

export async function fetchSightengineByBytes(
  bytes: Uint8Array,
  filename = "photo.jpg"
): Promise<Record<string, unknown>> {
  const { apiUser, apiSecret, models } = credentials();
  const form = new FormData();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  form.set("media", new Blob([copy]), filename);
  form.set("models", models);
  form.set("api_user", apiUser);
  form.set("api_secret", apiSecret);
  const res = await fetch(SIGHTENGINE_ENDPOINT, { method: "POST", body: form });
  return parseSightengineResponse(res);
}

async function parseSightengineResponse(res: Response): Promise<Record<string, unknown>> {
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Sightengine HTTP ${res.status}`);
  }
  if (data.status !== "success") {
    throw new Error(`Sightengine error: ${JSON.stringify(data.error ?? data.status)}`);
  }
  return data;
}

export async function decideFromRaw(raw: Record<string, unknown>): Promise<Decision> {
  const settings = await getModerationSettings();
  return decide(collectCatalogScores(raw), settings);
}

function skippedResult(): ModerationResult {
  return {
    ok: true,
    skipped: true,
    topScore: 0,
    topClass: null,
    scores: {},
    triggered: [],
    raw: null,
  };
}

function toResult(decision: Decision, raw: Record<string, unknown>): ModerationResult {
  return {
    ok: decision.ok,
    skipped: false,
    topScore: decision.topScore,
    topClass: decision.topClass,
    scores: decision.scores,
    triggered: decision.triggered,
    raw,
  };
}

/**
 * Scan an image Sightengine can fetch and decide pass/reject.
 * Throws on network/API failure so the caller can leave the photo in
 * `scanning` rather than silently approving it.
 */
export async function scanImageUrl(imageUrl: string): Promise<ModerationResult> {
  if (!isModerationConfigured()) {
    console.warn("moderation: SIGHTENGINE_USER/SECRET not set — scan skipped (photo passes)");
    return skippedResult();
  }
  const raw = await fetchSightengineByUrl(imageUrl);
  return toResult(await decideFromRaw(raw), raw);
}

export async function scanImageBytes(
  bytes: Uint8Array,
  filename = "photo.jpg"
): Promise<ModerationResult> {
  if (!isModerationConfigured()) {
    return skippedResult();
  }
  const raw = await fetchSightengineByBytes(bytes, filename);
  return toResult(await decideFromRaw(raw), raw);
}
