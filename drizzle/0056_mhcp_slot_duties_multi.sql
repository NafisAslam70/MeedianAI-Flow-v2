ALTER TABLE "mhcp_slot_duties"
  ADD COLUMN "assigned_user_ids" integer[] DEFAULT '{}';
