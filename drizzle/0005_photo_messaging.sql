-- v3: DM photo messaging — reusable photo library, blur-until-reveal,
-- sender hide toggle. See design_handoff_photo_messaging/photo-feature-handoff-v3.md.

-- Reusable per-user photo library (max 10 ready, enforced in API)
CREATE TABLE "user_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"blur_data_url" text NOT NULL,
	"aspect_ratio" double precision DEFAULT 1 NOT NULL,
	"is_live" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'scanning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_photos_user_idx" ON "user_photos" ("user_id");--> statement-breakpoint

-- Photos attached to a message (max 5, ordered)
CREATE TABLE "message_photos" (
	"message_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"hidden_by_sender" boolean DEFAULT false NOT NULL,
	CONSTRAINT "message_photos_message_id_photo_id_pk" PRIMARY KEY("message_id","photo_id")
);--> statement-breakpoint
ALTER TABLE "message_photos" ADD CONSTRAINT "message_photos_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_photos" ADD CONSTRAINT "message_photos_photo_id_user_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "user_photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Reveal grants (tap-to-reveal ships in v3; viewed_at reserved for view-once)
CREATE TABLE "photo_reveals" (
	"message_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"viewer_id" uuid NOT NULL,
	"requested_at" timestamp with time zone,
	"granted_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	CONSTRAINT "photo_reveals_message_id_photo_id_viewer_id_pk" PRIMARY KEY("message_id","photo_id","viewer_id")
);--> statement-breakpoint
ALTER TABLE "photo_reveals" ADD CONSTRAINT "photo_reveals_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_reveals" ADD CONSTRAINT "photo_reveals_message_photo_fk" FOREIGN KEY ("message_id","photo_id") REFERENCES "message_photos"("message_id","photo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Photos attached to a post (Phase 4 surface; table ships now)
CREATE TABLE "post_photos" (
	"post_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "post_photos_post_id_photo_id_pk" PRIMARY KEY("post_id","photo_id")
);--> statement-breakpoint
ALTER TABLE "post_photos" ADD CONSTRAINT "post_photos_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_photos" ADD CONSTRAINT "post_photos_photo_id_user_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "user_photos"("id") ON DELETE cascade ON UPDATE no action;
