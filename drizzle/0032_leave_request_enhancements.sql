ALTER TABLE "leave_requests"
    ADD COLUMN IF NOT EXISTS "approved_start_date" timestamp,
    ADD COLUMN IF NOT EXISTS "approved_end_date" timestamp,
    ADD COLUMN IF NOT EXISTS "decision_note" text,
    ADD COLUMN IF NOT EXISTS "member_message" text,
    ADD COLUMN IF NOT EXISTS "rejection_reason" text,
    ADD COLUMN IF NOT EXISTS "escalation_matter_id" integer REFERENCES "escalations_matters"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_leave_requests_escalation" ON "leave_requests" ("escalation_matter_id");
