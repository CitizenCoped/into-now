-- v8: per-surface Sightengine profiles (DM vs Posts) and an admin
-- visibility overlay for live post media / posts.
-- See design: ~/.claude/plans (v8 moderation admin).
--
-- Takedowns live on user_photos (not post_photos) so a taken-down item
-- can't be re-attached to a new post and survives the 24h post-expiry
-- cascade. Hiding a whole post lives on posts.

-- One moderation_settings row per surface. The old reader used
-- newest-by-updated_at; keep exactly that row as the DM profile.
ALTER TABLE "moderation_settings" ADD COLUMN "surface" text DEFAULT 'dm' NOT NULL;--> statement-breakpoint
DELETE FROM "moderation_settings"
WHERE "id" NOT IN (SELECT "id" FROM "moderation_settings" ORDER BY "updated_at" DESC LIMIT 1);--> statement-breakpoint
-- Seed the Posts profile by copying DM (same thresholds to start).
INSERT INTO "moderation_settings" ("surface", "classes", "updated_by")
SELECT 'posts', "classes", "updated_by" FROM "moderation_settings" WHERE "surface" = 'dm';--> statement-breakpoint
-- Fresh databases (no row yet): seed both from catalog defaults.
INSERT INTO "moderation_settings" ("surface", "classes")
SELECT s.surface, '{
  "nudity.sexual_activity":{"enabled":true,"threshold":0.6},
  "nudity.sexual_display":{"enabled":true,"threshold":0.6},
  "nudity.erotica":{"enabled":true,"threshold":0.6},
  "nudity.very_suggestive":{"enabled":false,"threshold":0.85},
  "gore.prob":{"enabled":true,"threshold":0.6},
  "offensive.prob":{"enabled":true,"threshold":0.6},
  "offensive.middle_finger":{"enabled":false,"threshold":0.7}
}'::jsonb
FROM (VALUES ('dm'), ('posts')) AS s(surface)
WHERE NOT EXISTS (SELECT 1 FROM "moderation_settings" m WHERE m."surface" = s.surface);--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_settings_surface_idx" ON "moderation_settings" ("surface");--> statement-breakpoint

-- Admin takedown overlay + re-scan stamp on media.
ALTER TABLE "user_photos" ADD COLUMN "admin_hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "admin_hidden_by" uuid;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "admin_hidden_reason" text;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "rescanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_admin_hidden_by_admin_users_id_fk" FOREIGN KEY ("admin_hidden_by") REFERENCES "admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_photos_purpose_created_idx" ON "user_photos" ("purpose","created_at");--> statement-breakpoint

-- Hide a whole post from the public feed, map, and thread reference.
ALTER TABLE "posts" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "hidden_by" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "hidden_reason" text;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_hidden_by_admin_users_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "admin_users"("id") ON DELETE set null ON UPDATE no action;
