CREATE TABLE IF NOT EXISTS "member_ads" (
    "id" serial PRIMARY KEY,
    "member_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "category" text NOT NULL,
    "occurred_at" timestamp NOT NULL,
    "evidence" text,
    "notes" text,
    "points" integer NOT NULL DEFAULT 5,
    "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
    "escalation_matter_id" integer REFERENCES "escalations_matters"("id") ON DELETE SET NULL,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "member_ads_member_idx" ON "member_ads" ("member_id");
CREATE INDEX IF NOT EXISTS "member_ads_created_by_idx" ON "member_ads" ("created_by");
CREATE INDEX IF NOT EXISTS "member_ads_occurred_at_idx" ON "member_ads" ("occurred_at");
CREATE INDEX IF NOT EXISTS "member_ads_escalation_idx" ON "member_ads" ("escalation_matter_id");
