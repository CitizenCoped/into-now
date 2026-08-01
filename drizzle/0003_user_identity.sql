-- Phase 2: user identity token (M | W | T | MW | MM | WW), nullable.
-- Powers "for me" post matching and pre-fills the posting "You are" picker.
ALTER TABLE "users" ADD COLUMN "identity" text;
