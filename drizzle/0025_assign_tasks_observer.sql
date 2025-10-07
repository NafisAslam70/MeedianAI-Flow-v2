ALTER TABLE assigned_tasks
    ADD COLUMN IF NOT EXISTS observer_id integer REFERENCES users(id) ON DELETE SET NULL;

UPDATE assigned_tasks
   SET observer_id = created_by
 WHERE observer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_assigned_tasks_observer_id
    ON assigned_tasks(observer_id);
