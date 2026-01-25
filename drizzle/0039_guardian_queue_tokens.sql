ALTER TABLE "guardian_gate_logs"
  ADD COLUMN IF NOT EXISTS "token_number" integer,
  ADD COLUMN IF NOT EXISTS "queue_status" varchar(16),
  ADD COLUMN IF NOT EXISTS "called_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "served_at" timestamptz;

CREATE INDEX IF NOT EXISTS "guardian_gate_logs_token_idx" ON "guardian_gate_logs" ("visit_date", "token_number");
CREATE INDEX IF NOT EXISTS "guardian_gate_logs_queue_idx" ON "guardian_gate_logs" ("visit_date", "queue_status");
