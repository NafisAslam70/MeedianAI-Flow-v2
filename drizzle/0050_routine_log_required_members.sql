-- Store explicit members who must fill routine log at day close
CREATE TABLE IF NOT EXISTS "routine_log_required_members" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "routine_log_required_members_user_unique" ON "routine_log_required_members" ("user_id");
