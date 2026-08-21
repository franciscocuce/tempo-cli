import type { Database } from "better-sqlite3";
import { hashToken } from "../auth/tokens.js";
import type { User } from "./users.js";

export const SESSION_TTL_MS = 30 * 86_400_000;

interface JoinedRow {
  id: number;
  email: string;
  created_at: string;
}

// en la base va el hash del token, nunca el token en sí
export function createSession(
  db: Database,
  userId: number,
  token: string,
  now: Date = new Date(),
  ttlMs: number = SESSION_TTL_MS
): void {
  db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    now.toISOString(),
    new Date(now.getTime() + ttlMs).toISOString()
  );
}

export function getSessionUser(
  db: Database,
  token: string,
  now: Date = new Date()
): User | undefined {
  const row = db
    .prepare(
      `SELECT users.id, users.email, users.created_at
         FROM sessions
         JOIN users ON users.id = sessions.user_id
        WHERE sessions.id = ? AND sessions.expires_at > ?`
    )
    .get(hashToken(token), now.toISOString()) as JoinedRow | undefined;

  return row ? { id: row.id, email: row.email, createdAt: row.created_at } : undefined;
}

export function deleteSession(db: Database, token: string): boolean {
  return db.prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token)).changes > 0;
}

export function deleteUserSessions(db: Database, userId: number): number {
  return db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId).changes;
}

export function pruneSessions(db: Database, now: Date = new Date()): number {
  return db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString()).changes;
}
