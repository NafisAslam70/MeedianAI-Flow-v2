-- Add section, track, active to classes and unique index
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS section varchar(8);
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS track varchar(32);
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_classes_name_section_track ON classes (name, section, track);
CREATE INDEX IF NOT EXISTS idx_classes_name ON classes (name);

