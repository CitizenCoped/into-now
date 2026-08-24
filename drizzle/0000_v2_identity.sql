-- v2 identity migration: extend users, add auth_codes, update FK cascades

ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_method" text DEFAULT 'phone' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_anonymous" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_date" date;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "age_verified_at" timestamptz;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photo_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "statement" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_lat" double precision;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_lng" double precision;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_location_at" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");

UPDATE "users" SET "auth_method" = 'phone', "is_anonymous" = false WHERE "auth_method" IS NULL OR "auth_method" = 'phone';

CREATE TABLE IF NOT EXISTS "auth_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel" text NOT NULL,
  "destination" text NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_sender_id_users_id_fk";
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE cascade;

ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_author_id_users_id_fk";
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE set null;

ALTER TABLE "live_sessions" DROP CONSTRAINT IF EXISTS "live_sessions_user_id_users_id_fk";
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;