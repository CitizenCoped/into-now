-- v7: post media — posts carry up to 4 photos, or 2 photos + 2 videos
-- (≤10s). See design_handoff_the_best_drug/FEATURE_POST_MEDIA_AND_THREAD_REF.md.
--
-- Videos live in `user_photos` beside photos so `post_photos.photo_id`
-- keeps its FK. `purpose` keeps post media out of the DM "My photos"
-- library (and its 10-slot cap) without a second table.

ALTER TABLE "user_photos" ADD COLUMN "kind" text DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "purpose" text DEFAULT 'library' NOT NULL;--> statement-breakpoint

-- The thread reference row looks up "this author's latest live post".
CREATE INDEX "posts_author_created_idx" ON "posts" ("author_id","created_at");
