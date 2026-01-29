-- Talent Bench tables
CREATE TABLE IF NOT EXISTS recruitment_bench (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  phone text NOT NULL,
  location text,
  applied_for text,
  applied_date date,
  link_url text,
  notes text,
  source text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recruitment_bench_phone ON recruitment_bench(phone);
CREATE INDEX IF NOT EXISTS idx_recruitment_bench_applied_for ON recruitment_bench(applied_for);

CREATE TABLE IF NOT EXISTS recruitment_bench_pushes (
  id serial PRIMARY KEY,
  bench_id integer NOT NULL REFERENCES recruitment_bench(id) ON DELETE CASCADE,
  candidate_id integer REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  program_id integer REFERENCES recruitment_meta_programs(id),
  msp_code_id integer REFERENCES msp_codes(id),
  location_id integer REFERENCES recruitment_meta_locations(id),
  pushed_by integer REFERENCES users(id),
  pushed_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recruitment_bench_push ON recruitment_bench_pushes(bench_id, program_id);
