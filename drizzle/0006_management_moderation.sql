CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_encrypted" text NOT NULL,
	"totp_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_username_idx" ON "admin_users" ("username");--> statement-breakpoint

CREATE TABLE "admin_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by" uuid,
	"pending_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invites_token_hash_idx" ON "admin_invites" ("token_hash");--> statement-breakpoint
ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_pending_admin_id_admin_users_id_fk" FOREIGN KEY ("pending_admin_id") REFERENCES "admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "moderation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"classes" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);--> statement-breakpoint
ALTER TABLE "moderation_settings" ADD CONSTRAINT "moderation_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

INSERT INTO "moderation_settings" ("classes")
VALUES ('{
  "nudity.sexual_activity":{"enabled":true,"threshold":0.6},
  "nudity.sexual_display":{"enabled":true,"threshold":0.6},
  "nudity.erotica":{"enabled":true,"threshold":0.6},
  "nudity.very_suggestive":{"enabled":false,"threshold":0.85},
  "gore.prob":{"enabled":true,"threshold":0.6},
  "offensive.prob":{"enabled":true,"threshold":0.6},
  "offensive.middle_finger":{"enabled":false,"threshold":0.7}
}'::jsonb);--> statement-breakpoint

ALTER TABLE "user_photos" ADD COLUMN "moderation_scores" jsonb;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "moderation_raw" jsonb;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "review_status" text;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "user_photos" ADD COLUMN "object_purge_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_reviewed_by_admin_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_photos_review_idx" ON "user_photos" ("review_status");--> statement-breakpoint
CREATE INDEX "user_photos_purge_idx" ON "user_photos" ("object_purge_at");
