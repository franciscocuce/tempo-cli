export const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  cron       TEXT    NOT NULL,
  type       TEXT    NOT NULL CHECK (type IN ('shell', 'http')),
  payload    TEXT    NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL
);
`;
