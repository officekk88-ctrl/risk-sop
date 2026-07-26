CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE project_status AS ENUM ('DRAFT', 'DUE_DILIGENCE', 'DECISION_PENDING', 'ARCHIVED');
CREATE TYPE checklist_status AS ENUM ('TODO', 'PASSED', 'FAILED', 'VERIFY', 'NOT_APPLICABLE');
CREATE TYPE risk_level AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'INFO');
CREATE TYPE risk_status AS ENUM ('OPEN', 'MITIGATING', 'REVIEW_PENDING', 'CLOSED');
CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
CREATE TYPE ai_review_status AS ENUM ('PROCESSING', 'REVIEW_REQUIRED', 'CONFIRMED', 'REJECTED', 'FAILED');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'MEMBER',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  district text,
  status project_status NOT NULL DEFAULT 'DRAFT',
  owner_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'MEMBER',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  address text NOT NULL,
  area_sqm numeric(12, 2),
  clear_height_m numeric(6, 2),
  certificate_usage text,
  intended_usage text,
  monthly_rent numeric(14, 2),
  lease_months integer,
  planned_courts integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT true
);

CREATE TABLE project_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES checklist_items(id),
  status checklist_status NOT NULL DEFAULT 'TODO',
  note text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, checklist_item_id)
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  category text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  storage_key text NOT NULL UNIQUE,
  parse_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE document_parse_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  extracted_text text,
  page_map jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  level risk_level NOT NULL,
  status risk_status NOT NULL DEFAULT 'OPEN',
  evidence text,
  recommendation text,
  document_id uuid REFERENCES documents(id),
  checklist_instance_id uuid REFERENCES project_checklist_items(id),
  close_reason text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  risk_id uuid REFERENCES risks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES users(id),
  due_date date,
  status task_status NOT NULL DEFAULT 'TODO',
  completion_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id),
  status ai_review_status NOT NULL DEFAULT 'PROCESSING',
  model text,
  prompt_version text,
  result jsonb,
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('PROCEED', 'CONDITIONAL', 'PAUSE', 'REJECT')),
  rationale text NOT NULL,
  decided_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT',
  snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  project_id uuid REFERENCES projects(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_checklist_project ON project_checklist_items(project_id);
CREATE INDEX idx_documents_project ON documents(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_risks_project_level ON risks(project_id, level);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_audit_logs_project_time ON audit_logs(project_id, created_at DESC);
