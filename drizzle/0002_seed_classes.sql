-- Seed/repair Classes rows with new columns (section, track, active)
-- Idempotent: updates existing rows by name; inserts missing ones.

-- 1) Ensure existing numeric classes are marked as Elementary
UPDATE classes
SET track = 'elementary', section = NULL, active = TRUE
WHERE name ~ '^[0-9]+$' AND (track IS DISTINCT FROM 'elementary' OR track IS NULL);

-- 2) Ensure existing Pre‑Primary classes are marked as pre_primary
UPDATE classes
SET track = 'pre_primary', section = NULL, active = TRUE
WHERE name IN ('Nursery','LKG','UKG') AND (track IS DISTINCT FROM 'pre_primary' OR track IS NULL);

-- 3) Insert missing Elementary classes 1..7
WITH required(name) AS (
  VALUES ('1'),('2'),('3'),('4'),('5'),('6'),('7')
)
INSERT INTO classes (name, track, active)
SELECT r.name, 'elementary', TRUE
FROM required r
WHERE NOT EXISTS (
  SELECT 1 FROM classes c WHERE c.name = r.name
);

-- 4) Insert missing Pre‑Primary classes
WITH required(name) AS (
  VALUES ('Nursery'),('LKG'),('UKG')
)
INSERT INTO classes (name, track, active)
SELECT r.name, 'pre_primary', TRUE
FROM required r
WHERE NOT EXISTS (
  SELECT 1 FROM classes c WHERE c.name = r.name
);

-- 5) Normalize obvious mis-entries: if a pre-primary label got marked numeric track, fix it
UPDATE classes SET track = 'pre_primary'
WHERE name IN ('Nursery','LKG','UKG') AND track <> 'pre_primary';

-- 6) Optional: deactivate any class explicitly listed as absent (example: '8')
-- UPDATE classes SET active = FALSE WHERE name = '8' AND track = 'elementary';

