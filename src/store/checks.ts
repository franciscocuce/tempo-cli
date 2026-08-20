import type { Database } from "better-sqlite3";

export const MAX_LIMIT = 500;
export const DEFAULT_LIMIT = 50;

export interface Check {
  id: number;
  monitorId: number;
  monitorName: string;
  checkedAt: string;
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number;
  error: string | null;
}

export interface NewCheck {
  monitorId: number;
  checkedAt: string;
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number;
  error: string | null;
}

interface CheckRow {
  id: number;
  monitor_id: number;
  monitor_name: string;
  checked_at: string;
  ok: number;
  http_status: number | null;
  latency_ms: number;
  error: string | null;
}

function rowToCheck(row: CheckRow): Check {
  return {
    id: row.id,
    monitorId: row.monitor_id,
    monitorName: row.monitor_name,
    checkedAt: row.checked_at,
    ok: row.ok === 1,
    httpStatus: row.http_status,
    latencyMs: row.latency_ms,
    error: row.error,
  };
}

export function clampLimit(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(value, MAX_LIMIT);
}

export function addCheck(db: Database, check: NewCheck): number {
  const result = db
    .prepare(
      `INSERT INTO checks (monitor_id, checked_at, ok, http_status, latency_ms, error)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      check.monitorId,
      check.checkedAt,
      check.ok ? 1 : 0,
      check.httpStatus,
      check.latencyMs,
      check.error
    );

  return Number(result.lastInsertRowid);
}

export interface ListChecksOptions {
  monitorId?: number;
  limit?: number;
}

export function listChecks(db: Database, options: ListChecksOptions = {}): Check[] {
  const limit = clampLimit(options.limit);
  const where = options.monitorId !== undefined ? "WHERE checks.monitor_id = ?" : "";
  const params =
    options.monitorId !== undefined ? [options.monitorId, limit] : ([limit] as number[]);

  const rows = db
    .prepare(
      `SELECT checks.*, monitors.name AS monitor_name
         FROM checks
         JOIN monitors ON monitors.id = checks.monitor_id
         ${where}
        ORDER BY checks.id DESC
        LIMIT ?`
    )
    .all(...params) as CheckRow[];

  return rows.map(rowToCheck);
}

// los últimos N del monitor, del más viejo al más nuevo, que es como los lee la máquina de estados
export function recentChecks(db: Database, monitorId: number, count: number): Check[] {
  return listChecks(db, { monitorId, limit: count }).reverse();
}

export function lastCheck(db: Database, monitorId: number): Check | undefined {
  return listChecks(db, { monitorId, limit: 1 })[0];
}
