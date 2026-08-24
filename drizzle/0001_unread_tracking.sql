-- unread tracking: add last_read_at to conversation_participants

ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "last_read_at" timestamptz;
