-- Add time sensitivity fields to mri_role_tasks
ALTER TABLE mri_role_tasks
  ADD COLUMN IF NOT EXISTS time_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exec_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS window_start timestamp NULL,
  ADD COLUMN IF NOT EXISTS window_end timestamp NULL;

