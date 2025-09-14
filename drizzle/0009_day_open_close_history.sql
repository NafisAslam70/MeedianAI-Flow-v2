CREATE TABLE IF NOT EXISTS "day_open_close_history" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "date" timestamp NOT NULL,
  "opened_at" time,
  "closed_at" time,
  "source" varchar(32) NOT NULL DEFAULT 'system',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_day_open_close_user_date" ON "day_open_close_history" ("user_id","date");
