CREATE TABLE knowledge_source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  storage_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('PROCESSING', 'IMPORTED', 'FAILED')),
  parse_method text,
  extracted_text text,
  ai_summary text,
  ai_model text,
  prompt_version text,
  error_message text,
  imported_entry_ids uuid[] NOT NULL DEFAULT '{}',
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_entries
  ADD COLUMN source_document_id uuid REFERENCES knowledge_source_documents(id) ON DELETE SET NULL;

CREATE INDEX idx_knowledge_source_documents_uploader_time
  ON knowledge_source_documents(uploaded_by, created_at DESC);
