-- Optional expected attendance roster per program
ALTER TABLE "mri_programs"
  ADD COLUMN IF NOT EXISTS "attendance_member_ids" integer[];
