CREATE TABLE IF NOT EXISTS "msp_code_families" (
  "id" serial PRIMARY KEY,
  "key" varchar(32) NOT NULL UNIQUE,
  "name" varchar(120) NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "msp_code_families_active_idx" ON "msp_code_families" ("active");
