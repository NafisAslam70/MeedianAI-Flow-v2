-- Grants: allow admin to share specific admin sections with managers
CREATE TABLE IF NOT EXISTS "manager_section_grants" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "section" varchar(64) NOT NULL,
  "can_write" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uniq_manager_section_grant UNIQUE ("user_id","section")
);

