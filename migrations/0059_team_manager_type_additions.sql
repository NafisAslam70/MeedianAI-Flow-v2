DO $$
BEGIN
  ALTER TYPE "team_manager_type" ADD VALUE IF NOT EXISTS 'hod';
  ALTER TYPE "team_manager_type" ADD VALUE IF NOT EXISTS 'admin_asst';
  ALTER TYPE "team_manager_type" ADD VALUE IF NOT EXISTS 'social_media_head_asst';
END $$;
