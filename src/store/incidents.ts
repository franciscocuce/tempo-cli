import type { Database } from "better-sqlite3";
import { clampLimit } from "./checks.js";

export interface Incident {
  id: number;
  monitorId: number;
  monitorName: string;
  startedAt: string;
  resolvedAt: string | null;
  cause: string;
  failedChecks: number;
  durationMs: number | null;
}

interface IncidentRow {
  id: number;
  monitor_id: number;
  monitor_name: string;
  started_at: string;
  resolved_at: string | null;
  cause: string;
  failed_checks: number;
}

function rowToIncident(row: IncidentRow): Incident {
  const startedAt = new Date(row.started_at).getTime();
  const resolvedAt = row.resolved_at === null ? null : new Date(row.resolved_at).getTime();

  return {
    id: row.id,
    monitorId: row.monitor_id,
    monitorName: row.monitor_name,
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
    cause: row.cause,
    failedChecks: row.failed_checks,
    durationMs: resolvedAt === null ? null : resolvedAt - startedAt,
  };
}

const SELECT = `
  SELECT incidents.*, monitors.name AS monitor_name
    FROM incidents
    JOIN monitors ON monitors.id = incidents.monitor_id
`;

export function openIncident(
  db: Database,
  monitorId: number,
  startedAt: string,
  cause: string,
  failedChecks: number
): number {
  const result = db
    .prepare(
      `INSERT INTO incidents (monitor_id, started_at, cause, failed_checks)
       VALUES (?, ?, ?, ?)`
    )
    .run(monitorId, startedAt, cause, failedChecks);

  return Number(result.lastInsertRowid);
}

export function getOpenIncident(db: Database, monitorId: number): Incident | undefined {
  const row = db
    .prepare(`${SELECT} WHERE incidents.monitor_id = ? AND incidents.resolved_at IS NULL
              ORDER BY incidents.id DESC LIMIT 1`)
    .get(monitorId) as IncidentRow | undefined;

  return row ? rowToIncident(row) : undefined;
}

export function resolveIncident(db: Database, id: number, resolvedAt: string): boolean {
  return (
    db
      .prepare("UPDATE incidents SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL")
      .run(resolvedAt, id).changes > 0
  );
}

export function bumpFailedChecks(db: Database, id: number): void {
  db.prepare("UPDATE incidents SET failed_checks = failed_checks + 1 WHERE id = ?").run(id);
}

export interface ListIncidentsOptions {
  monitorId?: number;
  limit?: number;
  onlyOpen?: boolean;
}

export function listIncidents(db: Database, options: ListIncidentsOptions = {}): Incident[] {
  const limit = clampLimit(options.limit);
  const conditions: string[] = [];
  const params: (number | string)[] = [];

  if (options.monitorId !== undefined) {
    conditions.push("incidents.monitor_id = ?");
    params.push(options.monitorId);
  }
  if (options.onlyOpen === true) {
    conditions.push("incidents.resolved_at IS NULL");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(`${SELECT} ${where} ORDER BY incidents.id DESC LIMIT ?`)
    .all(...params, limit) as IncidentRow[];

  return rows.map(rowToIncident);
}

export function countOpenIncidents(db: Database): number {
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM incidents WHERE resolved_at IS NULL")
    .get() as { total: number };
  return row.total;
}
