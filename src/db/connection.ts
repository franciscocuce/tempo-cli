import Database from "better-sqlite3";
import { SCHEMA } from "./schema.js";

export const DEFAULT_DB_PATH = "tempo.db";

export function openDb(path: string = DEFAULT_DB_PATH): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}
