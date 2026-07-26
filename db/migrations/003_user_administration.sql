ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);

COMMENT ON COLUMN users.active IS '停用后拒绝登录并使现有会话在下一次请求时失效';
