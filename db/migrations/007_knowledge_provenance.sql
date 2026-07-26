ALTER TABLE knowledge_entries
  ADD COLUMN source_url text NOT NULL DEFAULT '',
  ADD COLUMN updated_by uuid REFERENCES users(id);

UPDATE knowledge_entries
SET updated_by = COALESCE(reviewed_by, created_by)
WHERE updated_by IS NULL;

ALTER TABLE knowledge_entries
  ALTER COLUMN updated_by SET NOT NULL;
