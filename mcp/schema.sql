CREATE TABLE IF NOT EXISTS oauth_transactions (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_transactions_expiry ON oauth_transactions(expires_at);
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_name TEXT NOT NULL,
  scopes TEXT NOT NULL, encrypted_session TEXT,
  grant_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  revoked_at INTEGER, refresh_owner TEXT, refresh_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS connections_user ON connections(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
