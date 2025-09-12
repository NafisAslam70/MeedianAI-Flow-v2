-- Add nullable is_teacher flag to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_teacher boolean NULL;

