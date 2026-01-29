-- Drop unique constraint so multiple requirements per program are allowed
DO 44238 BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_recruitment_program_location'
    ) THEN
        EXECUTE 'DROP INDEX IF EXISTS "uniq_recruitment_program_location"';
    END IF;
END 44238;

CREATE INDEX IF NOT EXISTS idx_recruitment_program ON recruitment_program_requirements(program_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_location ON recruitment_program_requirements(location_id);
