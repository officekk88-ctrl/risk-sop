ALTER TABLE knowledge_entries
  ADD COLUMN origin text NOT NULL DEFAULT 'MANUAL'
    CHECK (origin IN ('MANUAL', 'DOCUMENT_IMPORT', 'AI_CONSULTATION', 'SYSTEM_SEED')),
  ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN conversation_id uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
  ADD COLUMN question text NOT NULL DEFAULT '';

UPDATE knowledge_entries
SET origin = 'DOCUMENT_IMPORT'
WHERE source_document_id IS NOT NULL;

CREATE INDEX idx_knowledge_entries_origin_created
  ON knowledge_entries(origin, created_at DESC);

CREATE INDEX idx_knowledge_entries_conversation
  ON knowledge_entries(conversation_id)
  WHERE conversation_id IS NOT NULL;
