-- Add description column to daily_slots for NMRI slot notes
ALTER TABLE "daily_slots" ADD COLUMN IF NOT EXISTS "description" text;

