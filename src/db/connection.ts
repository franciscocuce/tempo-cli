import { homedir } from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { migrate } from "./migrations/index.js";

export const IN_MEMORY = ":memory:";

export function dataDir(): string {
  return process.env.TEMPO_DATA_DIR ?? path.join(homedir(), ".tempo");
}

export function defaultDbPath(): string {
  return path.join(dataDir(), "tempo.db");
}

export function openDb(dbPath: string = defaultDbPath()): Database.Database {
  if (dbPath !== IN_MEMORY) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}
