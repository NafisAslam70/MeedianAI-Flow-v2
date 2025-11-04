ALTER TABLE "leave_requests"
    ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'personal',
    ADD COLUMN IF NOT EXISTS "convert_to_cl" boolean DEFAULT false NOT NULL;
