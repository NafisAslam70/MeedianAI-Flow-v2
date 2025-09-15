-- Add program_id to manager_section_grants for per-program grants
ALTER TABLE "manager_section_grants" ADD COLUMN IF NOT EXISTS "program_id" integer REFERENCES "mri_programs"("id");
DO $$ BEGIN
  ALTER TABLE "manager_section_grants" DROP CONSTRAINT IF EXISTS uniq_manager_section_grant;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
ALTER TABLE "manager_section_grants" ADD CONSTRAINT uniq_manager_section_grant UNIQUE ("user_id","section","program_id");

