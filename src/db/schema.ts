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

CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  started_at  TEXT    NOT NULL,
  duration_ms INTEGER NOT NULL,
  status      TEXT    NOT NULL CHECK (status IN ('ok', 'error')),
  output      TEXT    NOT NULL
);
`;
