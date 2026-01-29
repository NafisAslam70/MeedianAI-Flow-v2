-- Attendance cap per program and latecomer flagging
ALTER TABLE "mri_programs"
  ADD COLUMN IF NOT EXISTS "attendance_cap_time" time;

ALTER TABLE "final_daily_attendance"
  ADD COLUMN IF NOT EXISTS "is_late" boolean NOT NULL DEFAULT false;
