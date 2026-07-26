CREATE TYPE checklist_ai_status AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE checklist_ai_judgment AS ENUM ('PASSED', 'FAILED', 'VERIFY');
CREATE TYPE ai_confidence AS ENUM ('HIGH', 'MEDIUM', 'LOW');

CREATE TABLE document_checklist_links (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  checklist_instance_id uuid NOT NULL REFERENCES project_checklist_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, checklist_instance_id)
);

CREATE TABLE checklist_ai_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_instance_id uuid NOT NULL UNIQUE REFERENCES project_checklist_items(id) ON DELETE CASCADE,
  latest_document_id uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  status checklist_ai_status NOT NULL DEFAULT 'PROCESSING',
  judgment checklist_ai_judgment NOT NULL DEFAULT 'VERIFY',
  analysis text NOT NULL DEFAULT '',
  evidence text NOT NULL DEFAULT '',
  recommendation text NOT NULL DEFAULT '',
  confidence ai_confidence NOT NULL DEFAULT 'LOW',
  requires_expert_review boolean NOT NULL DEFAULT true,
  source text NOT NULL CHECK (source IN ('AI', 'MANUAL_EDIT')),
  model text,
  prompt_version text,
  error_message text NOT NULL DEFAULT '',
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_checklist_links_item ON document_checklist_links(checklist_instance_id);
CREATE INDEX idx_checklist_ai_assessments_status ON checklist_ai_assessments(status);
