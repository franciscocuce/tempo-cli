import type { Database } from "better-sqlite3";

export interface User {
  id: number;
  email: string;
  createdAt: string;
}

export interface UserWithHash extends User {
  passwordHash: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

function rowToUser(row: UserRow): User {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createUser(db: Database, email: string, passwordHash: string): User {
  const result = db
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
    .run(normalizeEmail(email), passwordHash, new Date().toISOString());

  return getUser(db, Number(result.lastInsertRowid))!;
}

export function getUser(db: Database, id: number): User | undefined {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? rowToUser(row) : undefined;
}

export function getUserByEmail(db: Database, email: string): UserWithHash | undefined {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email)) as
    | UserRow
    | undefined;

  return row ? { ...rowToUser(row), passwordHash: row.password_hash } : undefined;
}

export function listUsers(db: Database): User[] {
  const rows = db.prepare("SELECT * FROM users ORDER BY id").all() as UserRow[];
  return rows.map(rowToUser);
}

export function countUsers(db: Database): number {
  const row = db.prepare("SELECT COUNT(*) AS total FROM users").get() as { total: number };
  return row.total;
}

export function setPassword(db: Database, id: number, passwordHash: string): boolean {
  return db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id).changes > 0;
}

export function removeUser(db: Database, id: number): boolean {
  return db.prepare("DELETE FROM users WHERE id = ?").run(id).changes > 0;
}
