/**
 * Sightengine class catalog and pass/reject decision.
 *
 * Suggestive tiers and scene/type descriptors are off by default — they
 * read as high-confidence but are not the safety signals we act on
 * (`nudity.context.indoor_other`, `gore.type.real`, etc.).
 */

export const REJECT_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type ModerationClassPath =
  | "nudity.sexual_activity"
  | "nudity.sexual_display"
  | "nudity.erotica"
  | "nudity.very_suggestive"
  | "gore.prob"
  | "offensive.prob"
  | "offensive.middle_finger";

export type ClassSetting = {
  enabled: boolean;
  threshold: number;
};

export type ModerationSettingsMap = Record<ModerationClassPath, ClassSetting>;

export type CatalogEntry = {
  path: ModerationClassPath;
  label: string;
  group: "nudity" | "gore" | "offensive";
  description: string;
};

export const CLASS_CATALOG: readonly CatalogEntry[] = [
  {
    path: "nudity.sexual_activity",
    label: "Sexual activity",
    group: "nudity",
    description: "Explicit sexual activity.",
  },
  {
    path: "nudity.sexual_display",
    label: "Sexual display",
    group: "nudity",
    description: "Explicit sexual display / genitals.",
  },
  {
    path: "nudity.erotica",
    label: "Erotica",
    group: "nudity",
    description: "Erotic but not full sexual activity/display.",
  },
  {
    path: "nudity.very_suggestive",
    label: "Very suggestive",
    group: "nudity",
    description: "Off by default. Swimwear/cleavage often lands here.",
  },
  {
    path: "gore.prob",
    label: "Gore",
    group: "gore",
    description: "Aggregate gore / graphic violence probability.",
  },
  {
    path: "offensive.prob",
    label: "Offensive",
    group: "offensive",
    description: "Aggregate hate-symbol / offensive probability.",
  },
  {
    path: "offensive.middle_finger",
    label: "Middle finger",
    group: "offensive",
    description: "Off by default.",
  },
] as const;

export const DEFAULT_MODERATION_SETTINGS: ModerationSettingsMap = {
  "nudity.sexual_activity": { enabled: true, threshold: 0.6 },
  "nudity.sexual_display": { enabled: true, threshold: 0.6 },
  "nudity.erotica": { enabled: true, threshold: 0.6 },
  "nudity.very_suggestive": { enabled: false, threshold: 0.85 },
  "gore.prob": { enabled: true, threshold: 0.6 },
  "offensive.prob": { enabled: true, threshold: 0.6 },
  "offensive.middle_finger": { enabled: false, threshold: 0.7 },
};

export type TriggeredClass = {
  path: ModerationClassPath;
  score: number;
  threshold: number;
};

export type Decision = {
  ok: boolean;
  topScore: number;
  topClass: ModerationClassPath | null;
  scores: Partial<Record<ModerationClassPath, number>>;
  triggered: TriggeredClass[];
};

export function scoreAt(data: Record<string, unknown>, path: string): number | undefined {
  let node: unknown = data;
  for (const key of path.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === "number" ? node : undefined;
}

export function collectCatalogScores(
  data: Record<string, unknown>
): Partial<Record<ModerationClassPath, number>> {
  const scores: Partial<Record<ModerationClassPath, number>> = {};
  for (const entry of CLASS_CATALOG) {
    const score = scoreAt(data, entry.path);
    if (score !== undefined) scores[entry.path] = score;
  }
  return scores;
}

export function decide(
  scores: Partial<Record<string, number>>,
  settings: ModerationSettingsMap
): Decision {
  let top: { path: ModerationClassPath | null; score: number } = { path: null, score: 0 };
  const triggered: TriggeredClass[] = [];

  for (const entry of CLASS_CATALOG) {
    const setting = settings[entry.path];
    if (!setting?.enabled) continue;
    const score = scores[entry.path];
    if (score === undefined) continue;
    if (score > top.score) top = { path: entry.path, score };
    if (score >= setting.threshold) {
      triggered.push({ path: entry.path, score, threshold: setting.threshold });
    }
  }

  return {
    ok: triggered.length === 0,
    topScore: top.score,
    topClass: top.path,
    scores,
    triggered,
  };
}

export function clampThreshold(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

export function normalizeSettings(input: unknown): ModerationSettingsMap {
  const next: ModerationSettingsMap = { ...DEFAULT_MODERATION_SETTINGS };
  if (!input || typeof input !== "object") return next;

  const raw = input as Record<string, unknown>;
  for (const entry of CLASS_CATALOG) {
    const row = raw[entry.path];
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const threshold = clampThreshold(rec.threshold);
    next[entry.path] = {
      enabled: rec.enabled === undefined ? next[entry.path].enabled : Boolean(rec.enabled),
      threshold: threshold ?? next[entry.path].threshold,
    };
  }
  return next;
}
