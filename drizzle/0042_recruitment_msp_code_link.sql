ALTER TABLE "recruitment_candidates" ADD COLUMN IF NOT EXISTS "msp_code_id" integer REFERENCES "msp_codes"("id");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_recruitment_candidate_msp_code" ON "recruitment_candidates" ("msp_code_id");
