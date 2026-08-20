import type { Migration } from "./types.js";

export const monitors: Migration = {
  version: 2,
  name: "monitors",
  up: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS runs;
      DROP TABLE IF EXISTS tasks;

      CREATE TABLE monitors (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        name              TEXT    NOT NULL UNIQUE,
        url               TEXT    NOT NULL,
        method            TEXT    NOT NULL DEFAULT 'GET',
        cron              TEXT    NOT NULL,
        expected_status   TEXT    NOT NULL DEFAULT '2xx',
        keyword           TEXT,
        keyword_mode      TEXT    NOT NULL DEFAULT 'contains'
                                  CHECK (keyword_mode IN ('contains', 'absent')),
        timeout_ms        INTEGER NOT NULL DEFAULT 10000,
        follow_redirects  INTEGER NOT NULL DEFAULT 1,
        confirm_threshold INTEGER NOT NULL DEFAULT 2,
        enabled           INTEGER NOT NULL DEFAULT 1,
        is_public         INTEGER NOT NULL DEFAULT 1,
        cert_expires_at   TEXT,
        created_at        TEXT    NOT NULL
      );

      CREATE TABLE checks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        monitor_id  INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
        checked_at  TEXT    NOT NULL,
        ok          INTEGER NOT NULL,
        http_status INTEGER,
        latency_ms  INTEGER NOT NULL,
        error       TEXT
      );

      CREATE INDEX idx_checks_monitor ON checks (monitor_id, checked_at DESC);

      CREATE TABLE checks_daily (
        monitor_id  INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
        day         TEXT    NOT NULL,
        total       INTEGER NOT NULL,
        failed      INTEGER NOT NULL,
        avg_latency INTEGER NOT NULL,
        p95_latency INTEGER NOT NULL,
        PRIMARY KEY (monitor_id, day)
      );

      CREATE TABLE incidents (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        monitor_id    INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
        started_at    TEXT    NOT NULL,
        resolved_at   TEXT,
        cause         TEXT    NOT NULL,
        failed_checks INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX idx_incidents_monitor ON incidents (monitor_id, started_at DESC);

      CREATE TABLE channels (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        type       TEXT    NOT NULL CHECK (type IN ('discord')),
        label      TEXT    NOT NULL,
        target     TEXT    NOT NULL,
        enabled    INTEGER NOT NULL DEFAULT 1,
        created_at TEXT    NOT NULL
      );

      CREATE TABLE scheduler_lock (
        id           INTEGER PRIMARY KEY CHECK (id = 1),
        pid          INTEGER NOT NULL,
        host         TEXT    NOT NULL,
        heartbeat_at TEXT    NOT NULL
      );
    `);
  },
};
