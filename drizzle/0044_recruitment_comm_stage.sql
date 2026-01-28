ALTER TABLE "recruitment_communication_log" ADD COLUMN IF NOT EXISTS "stage_id" integer REFERENCES "recruitment_meta_stages"("id");
CREATE INDEX IF NOT EXISTS "idx_recruitment_comm_stage" ON "recruitment_communication_log" ("stage_id");
