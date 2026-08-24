-- Personals pivot: posts become "I am X, looking for Y" codes.
-- Old category-based test posts are wiped (locked decision: clean slate).
TRUNCATE TABLE "posts";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "poster_is" text NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "looking_for" text NOT NULL;
