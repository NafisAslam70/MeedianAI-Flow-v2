CREATE TYPE mri_report_status AS ENUM ('pending', 'draft', 'submitted', 'verified', 'waived');
CREATE TYPE mri_report_target AS ENUM ('user', 'role', 'program', 'class', 'team');

CREATE TABLE IF NOT EXISTS mri_report_templates (
    id SERIAL PRIMARY KEY,
    family_id INTEGER REFERENCES mri_families(id) ON DELETE SET NULL,
    key VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    allow_pre_submit BOOLEAN NOT NULL DEFAULT TRUE,
    default_frequency VARCHAR(32) NOT NULL DEFAULT 'daily',
    default_due_time TIME,
    instructions TEXT,
    form_schema JSONB NOT NULL DEFAULT '{"sections":[]}',
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mri_report_assignments (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES mri_report_templates(id) ON DELETE CASCADE,
    target_type mri_report_target NOT NULL DEFAULT 'user',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_def_id INTEGER REFERENCES mri_role_defs(id) ON DELETE CASCADE,
    program_id INTEGER REFERENCES mri_programs(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    target_label VARCHAR(160),
    start_date DATE,
    end_date DATE,
    scope_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT mri_report_assignments_template_user_class_unique UNIQUE (template_id, user_id, class_id)
);

CREATE INDEX IF NOT EXISTS mri_report_assignments_template_idx ON mri_report_assignments (template_id);
CREATE INDEX IF NOT EXISTS mri_report_assignments_user_idx ON mri_report_assignments (user_id);
CREATE INDEX IF NOT EXISTS mri_report_assignments_class_idx ON mri_report_assignments (class_id);

CREATE TABLE IF NOT EXISTS mri_report_instances (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES mri_report_templates(id) ON DELETE CASCADE,
    assignment_id INTEGER NOT NULL REFERENCES mri_report_assignments(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    due_at TIMESTAMP,
    status mri_report_status NOT NULL DEFAULT 'pending',
    payload JSONB,
    submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMP,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP,
    waived_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    waived_at TIMESTAMP,
    notes TEXT,
    confirmation_note TEXT,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT mri_report_instances_assignment_date_unique UNIQUE (assignment_id, target_date)
);

CREATE INDEX IF NOT EXISTS mri_report_instances_template_date_idx ON mri_report_instances (template_id, target_date);
CREATE INDEX IF NOT EXISTS mri_report_instances_assignment_idx ON mri_report_instances (assignment_id);
CREATE INDEX IF NOT EXISTS mri_report_instances_status_idx ON mri_report_instances (status);

CREATE TABLE IF NOT EXISTS mri_report_audits (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL REFERENCES mri_report_instances(id) ON DELETE CASCADE,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(32) NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mri_report_audits_instance_idx ON mri_report_audits (instance_id);

INSERT INTO mri_report_templates (family_id, key, name, description, allow_pre_submit, default_frequency, instructions, form_schema, meta)
VALUES (
    (SELECT id FROM mri_families WHERE key = 'amri' LIMIT 1),
    'pt_daily_report',
    'PT Daily Report',
    'Parent Teacher (Class Teacher) daily MRI register capturing Class Discipline Diary (CDD) and Class Curriculum Diary (CCD).',
    TRUE,
    'daily',
    'Office assistant fills in the CDD & CCD during school hours. Class teacher reviews the captured data and confirms during day close.',
    $${
      "sections": [
        {
          "key": "cddRows",
          "title": "Class Discipline Diary",
          "repeat": true,
          "fields": [
            { "id": "date", "type": "date", "label": "Date" },
            { "id": "assemblyUniformDefaulters", "type": "chips", "label": "Assembly/Uniform Defaulters" },
            { "id": "languageDefaulters", "type": "chips", "label": "Language Defaulters" },
            { "id": "homeworkDefaulters", "type": "chips", "label": "Homework Defaulters" },
            { "id": "disciplineDefaulters", "type": "chips", "label": "Discipline Defaulters" },
            { "id": "bestStudentOfDay", "type": "chips", "label": "Best Student(s) of the Day" },
            { "id": "absentStudents", "type": "chips", "label": "Absent Students" },
            { "id": "teacherSigned", "type": "select", "label": "CT Sign", "options": ["Yes", "No"] },
            { "id": "principalStamp", "type": "select", "label": "Principal Stamp", "options": ["Yes", "No"] }
          ]
        },
        {
          "key": "ccdRows",
          "title": "Class Curriculum Diary",
          "repeat": true,
          "fields": [
            { "id": "period", "type": "text", "label": "Period" },
            { "id": "subject", "type": "text", "label": "Subject" },
            { "id": "topic", "type": "text", "label": "Topic" },
            { "id": "classwork", "type": "textarea", "label": "Classwork (What happened)" },
            { "id": "homework", "type": "textarea", "label": "Homework (Assigned)" },
            { "id": "teacherSignature", "type": "select", "label": "Teacher Sign", "options": ["Yes", "No"] },
            { "id": "monitorInitials", "type": "select", "label": "Monitor Initials", "options": ["Yes", "No"] }
          ]
        },
        {
          "key": "attendanceRows",
          "title": "Attendance Snapshot",
          "repeat": true,
          "fields": [
            { "id": "session", "type": "text", "label": "Session (e.g., Morning)" },
            { "id": "absentStudents", "type": "chips", "label": "Absent Students" },
            { "id": "presentCount", "type": "text", "label": "Present Count" },
            { "id": "absentCount", "type": "text", "label": "Absent Count" },
            { "id": "notes", "type": "textarea", "label": "Notes / Exceptions" }
          ]
        }
      ]
    }$$::jsonb,
    $${
      "version": 4,
      "schema": "pt_daily_v1"
    }$$::jsonb
)
ON CONFLICT (key) DO NOTHING;
