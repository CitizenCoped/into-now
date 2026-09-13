import { getDb } from "@/lib/db";
import {
  DEFAULT_MODERATION_SETTINGS,
  normalizeSettings,
  type ModerationSettingsMap,
} from "@/lib/moderationCatalog";
import { moderationSettings } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

const CACHE_TTL_MS = 30_000;

let cache: { at: number; settings: ModerationSettingsMap } | null = null;

export function invalidateModerationSettingsCache() {
  cache = null;
}

export async function getModerationSettings(): Promise<ModerationSettingsMap> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.settings;
  }

  const [row] = await getDb()
    .select()
    .from(moderationSettings)
    .orderBy(desc(moderationSettings.updatedAt))
    .limit(1);

  const settings = normalizeSettings(row?.classes ?? DEFAULT_MODERATION_SETTINGS);
  cache = { at: Date.now(), settings };
  return settings;
}

export async function saveModerationSettings(
  input: unknown,
  adminId: string
): Promise<ModerationSettingsMap> {
  const settings = normalizeSettings(input);
  const db = getDb();
  const [existing] = await db
    .select({ id: moderationSettings.id })
    .from(moderationSettings)
    .orderBy(desc(moderationSettings.updatedAt))
    .limit(1);

  if (existing) {
    await db
      .update(moderationSettings)
      .set({
        classes: settings,
        updatedAt: new Date(),
        updatedBy: adminId,
      })
      .where(eq(moderationSettings.id, existing.id));
  } else {
    await db.insert(moderationSettings).values({
      classes: settings,
      updatedBy: adminId,
    });
  }

  cache = { at: Date.now(), settings };
  return settings;
}
