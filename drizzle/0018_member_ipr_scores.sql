CREATE TABLE "member_ipr_scores" (
    "id" serial PRIMARY KEY,
    "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
    "evaluated_for" date NOT NULL,
    "punctuality" integer NOT NULL DEFAULT 0,
    "academics" integer NOT NULL DEFAULT 0,
    "obedience_discipline" integer NOT NULL DEFAULT 0,
    "language_personality" integer NOT NULL DEFAULT 0,
    "will_skill" integer NOT NULL DEFAULT 0,
    "total_score" integer NOT NULL DEFAULT 0,
    "evaluator_id" integer REFERENCES "users"("id") ON DELETE set null,
    "remarks" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "member_ipr_scores_user_date_idx"
    ON "member_ipr_scores" ("user_id", "evaluated_for");

CREATE INDEX "member_ipr_scores_evaluator_idx"
    ON "member_ipr_scores" ("evaluator_id");
