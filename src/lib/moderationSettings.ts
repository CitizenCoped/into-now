import { getDb } from "@/lib/db";
import {
  DEFAULT_MODERATION_SETTINGS,
  MODERATION_SURFACES,
  normalizeSettings,
  type ModerationSettingsMap,
  type ModerationSurface,
} from "@/lib/moderationCatalog";
import { moderationSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";

const CACHE_TTL_MS = 30_000;

type CacheEntry = { at: number; settings: ModerationSettingsMap };
const cache: Partial<Record<ModerationSurface, CacheEntry>> = {};

export function invalidateModerationSettingsCache(surface?: ModerationSurface) {
  if (surface) delete cache[surface];
  else for (const s of MODERATION_SURFACES) delete cache[s];
}

/** Thresholds for one surface. Per-instance cache, 30s. */
export async function getModerationSettings(
  surface: ModerationSurface = "dm"
): Promise<ModerationSettingsMap> {
  const hit = cache[surface];
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.settings;
  }

  const [row] = await getDb()
    .select()
    .from(moderationSettings)
    .where(eq(moderationSettings.surface, surface))
    .limit(1);

  const settings = normalizeSettings(row?.classes ?? DEFAULT_MODERATION_SETTINGS);
  cache[surface] = { at: Date.now(), settings };
  return settings;
}

export async function getAllModerationSettings(): Promise<
  Record<ModerationSurface, ModerationSettingsMap>
> {
  const [dm, posts] = await Promise.all([
    getModerationSettings("dm"),
    getModerationSettings("posts"),
  ]);
  return { dm, posts };
}

export async function saveModerationSettings(
  surface: ModerationSurface,
  input: unknown,
  adminId: string
): Promise<ModerationSettingsMap> {
  const settings = normalizeSettings(input);
  const now = new Date();

  // One row per surface (unique index) — upsert by surface.
  await getDb()
    .insert(moderationSettings)
    .values({ surface, classes: settings, updatedAt: now, updatedBy: adminId })
    .onConflictDoUpdate({
      target: moderationSettings.surface,
      set: { classes: settings, updatedAt: now, updatedBy: adminId },
    });

  cache[surface] = { at: Date.now(), settings };
  return settings;
}
