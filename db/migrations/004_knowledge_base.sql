CREATE TYPE knowledge_category AS ENUM (
  'SITE_PROPERTY', 'PLANNING_USE', 'FIRE_SAFETY', 'CONSTRUCTION',
  'LEASE_LEGAL', 'LICENSE_COMPLIANCE', 'SPORTS_OPERATION',
  'SAFETY_INSURANCE', 'FINANCE_TAX', 'ENVIRONMENT_NEIGHBOR', 'OTHER'
);
CREATE TYPE knowledge_status AS ENUM ('PENDING', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  category knowledge_category NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  content text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  source_name text,
  status knowledge_status NOT NULL DEFAULT 'PENDING',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_entries_status_category ON knowledge_entries(status, category);
CREATE INDEX idx_knowledge_entries_search ON knowledge_entries USING gin (
  to_tsvector('simple', title || ' ' || summary || ' ' || content)
);
CREATE INDEX idx_knowledge_entries_keywords ON knowledge_entries USING gin (keywords);
