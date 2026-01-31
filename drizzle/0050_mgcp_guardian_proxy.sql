-- Ensure MGCP leads can reference existing guardians (ongoing kings)
ALTER TABLE mgcp_leads
ADD COLUMN IF NOT EXISTS guardian_id integer REFERENCES enrollment_guardians(id) ON DELETE SET NULL;

-- Enrich guardian gate logs with proxy + satisfaction fields (idempotent)
ALTER TABLE guardian_gate_logs
  ADD COLUMN IF NOT EXISTS is_proxy boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS proxy_name text,
  ADD COLUMN IF NOT EXISTS proxy_relation text,
  ADD COLUMN IF NOT EXISTS satisfaction_islamic integer,
  ADD COLUMN IF NOT EXISTS satisfaction_academic integer,
  ADD COLUMN IF NOT EXISTS purpose_note text,
  ADD COLUMN IF NOT EXISTS queue_status varchar(16),
  ADD COLUMN IF NOT EXISTS called_at timestamp,
  ADD COLUMN IF NOT EXISTS served_at timestamp,
  ADD COLUMN IF NOT EXISTS token_number integer,
  ADD COLUMN IF NOT EXISTS signature varchar(160),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Visitor gate logs table for non-guardian visitors
CREATE TABLE IF NOT EXISTS visitor_gate_logs (
  id serial PRIMARY KEY,
  visit_date date NOT NULL,
  visitor_name text NOT NULL,
  phone varchar(32),
  purpose text,
  in_at timestamp NOT NULL,
  out_at timestamp,
  notes text,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS visitor_gate_logs_date_idx ON visitor_gate_logs (visit_date);

