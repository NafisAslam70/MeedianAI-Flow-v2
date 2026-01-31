ALTER TABLE recruitment_bench ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_recruitment_bench_email ON recruitment_bench(email);
