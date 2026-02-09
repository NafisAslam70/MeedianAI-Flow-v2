CREATE TABLE IF NOT EXISTS mhcp_seeds (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES mri_programs(id) ON DELETE CASCADE,
  track TEXT NOT NULL DEFAULT 'both',
  label TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mhcp_seeds_program_track ON mhcp_seeds (program_id, track);
