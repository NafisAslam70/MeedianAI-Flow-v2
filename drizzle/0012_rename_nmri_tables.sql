-- Rename NMRI weekly tables for clarity
DO $$ BEGIN
  ALTER TABLE IF EXISTS "slot_weekly_roles" RENAME TO "nmri_slot_weekly_roles";
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE IF EXISTS "slot_role_assignments" RENAME TO "nmri_slot_role_assignments";
EXCEPTION WHEN undefined_table THEN NULL; END $$;

