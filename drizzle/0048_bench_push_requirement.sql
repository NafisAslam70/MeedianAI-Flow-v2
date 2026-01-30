-- Add requirement reference to bench pushes
ALTER TABLE recruitment_bench_pushes ADD COLUMN IF NOT EXISTS requirement_id integer REFERENCES recruitment_program_requirements(id);
CREATE INDEX IF NOT EXISTS idx_recruitment_bench_push_req ON recruitment_bench_pushes(requirement_id);
