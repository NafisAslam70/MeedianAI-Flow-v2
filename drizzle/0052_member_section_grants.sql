CREATE TABLE IF NOT EXISTS member_section_grants (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section varchar(64) NOT NULL,
  can_write boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_member_section_grant
  ON member_section_grants (user_id, section);

