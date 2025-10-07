CREATE TABLE IF NOT EXISTS assigned_task_observers (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES assigned_tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_assigned_task_observer UNIQUE (task_id, user_id)
);

INSERT INTO assigned_task_observers (task_id, user_id)
SELECT id, observer_id
FROM assigned_tasks
WHERE observer_id IS NOT NULL
ON CONFLICT DO NOTHING;
