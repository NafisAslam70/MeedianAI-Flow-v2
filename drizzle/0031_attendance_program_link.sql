-- Link attendance artifacts to MRI programs and capture target audience metadata
ALTER TABLE "mri_role_tasks"
  ADD COLUMN IF NOT EXISTS "execution_mode" varchar(32) NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "attendance_target" varchar(32) DEFAULT 'members',
  ADD COLUMN IF NOT EXISTS "attendance_program_key" varchar(32),
  ADD COLUMN IF NOT EXISTS "attendance_program_id" integer REFERENCES "mri_programs"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "attendance_track" varchar(32);

UPDATE "mri_role_tasks" t
SET
  execution_mode = 'attendance',
  attendance_target = COALESCE(lower((src.payload->>'target')), 'members'),
  attendance_program_key = upper(src.payload->>'programKey'),
  attendance_program_id = mp.id,
  attendance_track = NULLIF(lower(src.payload->>'track'), '')
FROM (
  SELECT id, action::jsonb AS payload
  FROM "mri_role_tasks"
  WHERE action IS NOT NULL
    AND action <> ''
    AND action LIKE '{%'
    AND jsonb_typeof(action::jsonb) = 'object'
    AND lower(action::jsonb->>'type') = 'scanner'
) AS src
LEFT JOIN "mri_programs" mp
  ON mp.program_key = upper(src.payload->>'programKey')
WHERE t.id = src.id;

UPDATE "mri_role_tasks"
SET
  execution_mode = 'attendance',
  attendance_target = 'members',
  attendance_program_key = upper(trim(split_part(regexp_replace(action, '^scanner\\s*:\\s*', ''), ':', 1))),
  attendance_program_id = mp.id,
  attendance_track = NULLIF(lower(trim(split_part(action, ':', 3))), '')
FROM "mri_programs" mp
WHERE action ILIKE 'scanner:%'
  AND mp.program_key = upper(trim(split_part(regexp_replace(action, '^scanner\\s*:\\s*', ''), ':', 1)));

ALTER TABLE "scanner_sessions"
  ADD COLUMN IF NOT EXISTS "program_id" integer REFERENCES "mri_programs"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "target" varchar(32) DEFAULT 'members';

UPDATE "scanner_sessions" s
SET
  program_id = mp.id,
  target = COALESCE(s.target, 'members')
FROM "mri_programs" mp
WHERE s.program_id IS NULL
  AND mp.program_key = s.program_key;

UPDATE "scanner_sessions"
SET target = 'members'
WHERE target IS NULL;

ALTER TABLE "final_daily_attendance"
  ADD COLUMN IF NOT EXISTS "program_id" integer REFERENCES "mri_programs"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "target" varchar(32) DEFAULT 'members';

ALTER TABLE "final_daily_absentees"
  ADD COLUMN IF NOT EXISTS "program_id" integer REFERENCES "mri_programs"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "target" varchar(32) DEFAULT 'members';

UPDATE "final_daily_attendance" f
SET
  program_id = mp.id,
  target = COALESCE(f.target, 'members')
FROM "scanner_sessions" s
LEFT JOIN "mri_programs" mp
  ON mp.program_key = s.program_key
WHERE f.program_id IS NULL
  AND f.session_id = s.id;

UPDATE "final_daily_absentees" f
SET
  program_id = mp.id,
  target = COALESCE(f.target, 'members')
FROM "scanner_sessions" s
LEFT JOIN "mri_programs" mp
  ON mp.program_key = s.program_key
WHERE f.program_id IS NULL
  AND f.session_id = s.id;
