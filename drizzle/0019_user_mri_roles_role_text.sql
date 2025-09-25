ALTER TABLE "user_mri_roles"
  ALTER COLUMN "role" TYPE varchar(64) USING "role"::text;
