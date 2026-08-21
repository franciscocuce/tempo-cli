import type { Migration } from "./types.js";

export const users: Migration = {
  version: 3,
  name: "users",
  up: (db) => {
    db.exec(`
      CREATE TABLE users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id         TEXT    PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT    NOT NULL,
        expires_at TEXT    NOT NULL
      );

      CREATE INDEX idx_sessions_user ON sessions (user_id);
    `);
  },
};
