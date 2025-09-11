-- Ensure unique roleDefId + title for ON CONFLICT upsert to work
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'mri_role_tasks_role_title_uniq'
  ) THEN
    CREATE UNIQUE INDEX mri_role_tasks_role_title_uniq
      ON "mri_role_tasks" ("role_def_id", "title");
  END IF;
END $$;

