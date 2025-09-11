-- Attendance tables: scanner_sessions and attendance_events
CREATE TABLE IF NOT EXISTS "scanner_sessions" (
  "id" serial PRIMARY KEY,
  "program_key" varchar(32) NOT NULL,
  "track" varchar(32),
  "role_key" varchar(64),
  "started_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "nonce" varchar(64) NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "expires_at" timestamp with time zone,
  "meta" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "attendance_events" (
  "id" serial PRIMARY KEY,
  "session_id" integer NOT NULL REFERENCES "scanner_sessions"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source" "attendance_source" NOT NULL DEFAULT 'qr',
  "client_ip" varchar(64),
  "wifi_ssid" varchar(64),
  "device_fp" varchar(128),
  "at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='attendance_events_session_user_unique'
  ) THEN
    CREATE UNIQUE INDEX attendance_events_session_user_unique ON "attendance_events" ("session_id", "user_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='attendance_events_user_at_idx'
  ) THEN
    CREATE INDEX attendance_events_user_at_idx ON "attendance_events" ("user_id", "at");
  END IF;
END $$;

