-- Full product framework: candidate venues, staged decisions, expert collaboration,
-- notifications, configuration and richer evidence/task metadata.
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_memberships (
  project_id uuid NOT NULL, user_id uuid NOT NULL, project_role text NOT NULL,
  field_permissions jsonb NOT NULL DEFAULT '{}', document_permissions jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (project_id, user_id)
);
CREATE TABLE IF NOT EXISTS candidate_venues (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, name text NOT NULL, is_primary boolean NOT NULL DEFAULT false,
  profile jsonb NOT NULL DEFAULT '{}', commercial_score numeric, risk_score numeric, eliminated_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_venues_project_idx ON candidate_venues(project_id);
CREATE TABLE IF NOT EXISTS project_stages (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, code text NOT NULL, name text NOT NULL, stage_order integer NOT NULL,
  status text NOT NULL, decision text NOT NULL, conditions text, decided_by uuid, decided_at timestamptz,
  UNIQUE(project_id, code)
);
CREATE TABLE IF NOT EXISTS decision_gates (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, code text NOT NULL, name text NOT NULL, stage_code text NOT NULL,
  decision text NOT NULL, required_materials jsonb NOT NULL DEFAULT '[]', blockers jsonb NOT NULL DEFAULT '[]',
  rationale text, approved_by uuid, approved_at timestamptz, UNIQUE(project_id, code)
);
CREATE TABLE IF NOT EXISTS expert_assignments (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, source_type text NOT NULL, source_id text, specialty text NOT NULL,
  title text NOT NULL, question text NOT NULL, urgency text NOT NULL, due_date date, expert_email text NOT NULL,
  expert_name text NOT NULL, qualification text, qualification_expires_at date, status text NOT NULL, opinion text,
  attachment_document_ids jsonb NOT NULL DEFAULT '[]', created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expert_assignments_project_idx ON expert_assignments(project_id, status);
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY, project_id uuid, recipient_email text NOT NULL, type text NOT NULL, title text NOT NULL,
  content text NOT NULL, href text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_email, read_at, created_at DESC);
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY, value jsonb NOT NULL, updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_group_id uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS evidence_form text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expires_at date;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sensitive boolean NOT NULL DEFAULT false;
