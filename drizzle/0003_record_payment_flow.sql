-- Add support for misc due items and payment allocations breakdowns

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'due_item' AND EXISTS (
      SELECT 1 FROM pg_enum e WHERE e.enumlabel = 'misc'
    )
  ) THEN
    ALTER TYPE due_item ADD VALUE 'misc';
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS payment_allocations (
  id serial PRIMARY KEY,
  payment_id integer NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  due_id integer REFERENCES student_dues(id) ON DELETE SET NULL,
  label varchar(120),
  category varchar(60),
  amount numeric(10, 2) NOT NULL,
  notes text,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_due ON payment_allocations(due_id);
