-- Add recurrence to time-sensitive role tasks
ALTER TABLE mri_role_tasks
  ADD COLUMN IF NOT EXISTS recurrence varchar(16) NULL;

