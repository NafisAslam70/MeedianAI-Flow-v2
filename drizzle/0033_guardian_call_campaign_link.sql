ALTER TABLE "guardian_call_reports"
ADD COLUMN IF NOT EXISTS "campaign_assignment_id" integer REFERENCES "mri_report_assignments" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "guardian_call_reports_campaign_idx"
ON "guardian_call_reports" ("campaign_assignment_id");
