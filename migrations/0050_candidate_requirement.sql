-- Add requirement_id to recruitment_candidates to tie each candidate to a current requirement
ALTER TABLE recruitment_candidates
  ADD COLUMN requirement_id INTEGER REFERENCES recruitment_program_requirements(id);

CREATE INDEX IF NOT EXISTS idx_recruitment_candidate_requirement ON recruitment_candidates(requirement_id);
