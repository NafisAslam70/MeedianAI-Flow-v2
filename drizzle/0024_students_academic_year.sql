ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "academic_year" varchar(20);

-- Populate missing academic years with current default if available
UPDATE "students"
SET "academic_year" = '2024-25'
WHERE "academic_year" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_students_academic_year" ON "students" ("academic_year");
