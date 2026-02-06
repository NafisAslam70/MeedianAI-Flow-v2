ALTER TABLE mgcp_villages
  ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE mgcp_lead_managers
  ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE mgcp_belt_guardians
  ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE mgcp_leads
  ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id) ON DELETE SET NULL;

