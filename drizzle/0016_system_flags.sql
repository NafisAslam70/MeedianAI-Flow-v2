CREATE TABLE IF NOT EXISTS "system_flags" (
  "key" varchar(64) PRIMARY KEY,
  "value" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
