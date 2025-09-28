CREATE TABLE IF NOT EXISTS "academic_years" (
    "code" varchar(20) PRIMARY KEY,
    "name" varchar(80) NOT NULL,
    "start_date" date,
    "end_date" date,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_current" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_academic_years_name" ON "academic_years" ("name");
CREATE INDEX IF NOT EXISTS "idx_academic_years_current" ON "academic_years" ("is_current");

-- Seed known academic years from existing finance tables
WITH distinct_years AS (
    SELECT NULLIF(TRIM(academic_year), '') AS code FROM fee_structures
    UNION
    SELECT NULLIF(TRIM(academic_year), '') FROM student_fees
    UNION
    SELECT NULLIF(TRIM(academic_year), '') FROM transport_fees
    UNION
    SELECT NULLIF(TRIM(academic_year), '') FROM financial_reports
    UNION
    SELECT NULLIF(TRIM(academic_year), '') FROM student_accounts
    UNION
    SELECT NULLIF(TRIM(academic_year), '') FROM student_dues
    UNION
    SELECT NULLIF(TRIM(academic_year), '') FROM payments
)
INSERT INTO "academic_years" ("code", "name")
SELECT DISTINCT code, code
FROM distinct_years
WHERE code IS NOT NULL
ON CONFLICT ("code") DO NOTHING;

-- Ensure a default academic year exists for new installations
INSERT INTO "academic_years" ("code", "name", "is_active", "is_current")
VALUES ('2024-25', '2024-25', true, true)
ON CONFLICT ("code") DO NOTHING;

-- Add academic year column to payments and backfill existing rows
ALTER TABLE "payments"
    ADD COLUMN IF NOT EXISTS "academic_year" varchar(20);

-- Relax existing NOT NULL constraints so migration is non-destructive
ALTER TABLE "fee_structures" ALTER COLUMN "academic_year" DROP NOT NULL;
ALTER TABLE "student_fees" ALTER COLUMN "academic_year" DROP NOT NULL;
ALTER TABLE "transport_fees" ALTER COLUMN "academic_year" DROP NOT NULL;
ALTER TABLE "financial_reports" ALTER COLUMN "academic_year" DROP NOT NULL;
ALTER TABLE "student_accounts" ALTER COLUMN "academic_year" DROP NOT NULL;
ALTER TABLE "student_dues" ALTER COLUMN "academic_year" DROP NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "academic_year" DROP NOT NULL;

UPDATE "payments" p
SET "academic_year" = sf."academic_year"
FROM "student_fees" sf
WHERE p."student_fee_id" = sf."id";

WITH latest_accounts AS (
    SELECT DISTINCT ON (student_id) student_id, academic_year
    FROM "student_accounts"
    WHERE academic_year IS NOT NULL
    ORDER BY student_id, opened_at DESC NULLS LAST
)
UPDATE "payments" p
SET "academic_year" = la.academic_year
FROM latest_accounts la
WHERE p.academic_year IS NULL
  AND la.student_id = p.student_id;

UPDATE "payments"
SET "academic_year" = '2024-25'
WHERE "academic_year" IS NULL;

-- Foreign key constraints tying finance tables to academic years
ALTER TABLE "fee_structures"
    ADD CONSTRAINT "fee_structures_academic_year_fkey"
        FOREIGN KEY ("academic_year") REFERENCES "academic_years"("code") ON DELETE RESTRICT;

ALTER TABLE "student_fees"
    ADD CONSTRAINT "student_fees_academic_year_fkey"
        FOREIGN KEY ("academic_year") REFERENCES "academic_years"("code") ON DELETE RESTRICT;

ALTER TABLE "transport_fees"
    ADD CONSTRAINT "transport_fees_academic_year_fkey"
        FOREIGN KEY ("academic_year") REFERENCES "academic_years"("code") ON DELETE RESTRICT;

ALTER TABLE "financial_reports"
    ADD CONSTRAINT "financial_reports_academic_year_fkey"
        FOREIGN KEY ("academic_year") REFERENCES "academic_years"("code") ON DELETE RESTRICT;

ALTER TABLE "student_accounts"
    ADD CONSTRAINT "student_accounts_academic_year_fkey"
        FOREIGN KEY ("academic_year") REFERENCES "academic_years"("code") ON DELETE RESTRICT;

ALTER TABLE "student_dues"
    ADD CONSTRAINT "student_dues_academic_year_fkey"
        FOREIGN KEY ("academic_year") REFERENCES "academic_years"("code") ON DELETE RESTRICT;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_academic_year_fkey"
        FOREIGN KEY ("academic_year") REFERENCES "academic_years"("code") ON DELETE RESTRICT;

-- Mark the latest academic year as current if none flagged
WITH current_marked AS (
    SELECT 1 FROM "academic_years" WHERE "is_current" = true LIMIT 1
), latest_year AS (
    SELECT code FROM "academic_years" ORDER BY code DESC LIMIT 1
)
UPDATE "academic_years"
SET "is_current" = true
WHERE "code" = (SELECT code FROM latest_year)
  AND NOT EXISTS (SELECT 1 FROM current_marked);
