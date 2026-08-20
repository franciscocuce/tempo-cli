import type { Database } from "better-sqlite3";
import type { KeywordMode } from "../checks/types.js";

export interface Monitor {
  id: number;
  name: string;
  url: string;
  method: string;
  cron: string;
  expectedStatus: string;
  keyword: string | null;
  keywordMode: KeywordMode;
  timeoutMs: number;
  followRedirects: boolean;
  confirmThreshold: number;
  enabled: boolean;
  isPublic: boolean;
  certExpiresAt: string | null;
  createdAt: string;
}

export interface NewMonitor {
  name: string;
  url: string;
  method: string;
  cron: string;
  expectedStatus: string;
  keyword: string | null;
  keywordMode: KeywordMode;
  timeoutMs: number;
  followRedirects: boolean;
  confirmThreshold: number;
  isPublic: boolean;
}

export type MonitorPatch = Partial<NewMonitor> & { enabled?: boolean };

interface MonitorRow {
  id: number;
  name: string;
  url: string;
  method: string;
  cron: string;
  expected_status: string;
  keyword: string | null;
  keyword_mode: KeywordMode;
  timeout_ms: number;
  follow_redirects: number;
  confirm_threshold: number;
  enabled: number;
  is_public: number;
  cert_expires_at: string | null;
  created_at: string;
}

// mapa entre el nombre del campo en JS y la columna, para armar el UPDATE parcial
const COLUMNS: Record<keyof MonitorPatch, string> = {
  name: "name",
  url: "url",
  method: "method",
  cron: "cron",
  expectedStatus: "expected_status",
  keyword: "keyword",
  keywordMode: "keyword_mode",
  timeoutMs: "timeout_ms",
  followRedirects: "follow_redirects",
  confirmThreshold: "confirm_threshold",
  isPublic: "is_public",
  enabled: "enabled",
};

function rowToMonitor(row: MonitorRow): Monitor {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    method: row.method,
    cron: row.cron,
    expectedStatus: row.expected_status,
    keyword: row.keyword,
    keywordMode: row.keyword_mode,
    timeoutMs: row.timeout_ms,
    followRedirects: row.follow_redirects === 1,
    confirmThreshold: row.confirm_threshold,
    enabled: row.enabled === 1,
    isPublic: row.is_public === 1,
    certExpiresAt: row.cert_expires_at,
    createdAt: row.created_at,
  };
}

export function addMonitor(db: Database, input: NewMonitor): Monitor {
  const result = db
    .prepare(
      `INSERT INTO monitors
         (name, url, method, cron, expected_status, keyword, keyword_mode,
          timeout_ms, follow_redirects, confirm_threshold, enabled, is_public, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(
      input.name,
      input.url,
      input.method,
      input.cron,
      input.expectedStatus,
      input.keyword,
      input.keywordMode,
      input.timeoutMs,
      input.followRedirects ? 1 : 0,
      input.confirmThreshold,
      input.isPublic ? 1 : 0,
      new Date().toISOString()
    );

  return getMonitor(db, Number(result.lastInsertRowid))!;
}

export function listMonitors(db: Database): Monitor[] {
  const rows = db.prepare("SELECT * FROM monitors ORDER BY id").all() as MonitorRow[];
  return rows.map(rowToMonitor);
}

export function listPublicMonitors(db: Database): Monitor[] {
  const rows = db
    .prepare("SELECT * FROM monitors WHERE is_public = 1 ORDER BY id")
    .all() as MonitorRow[];
  return rows.map(rowToMonitor);
}

export function getMonitor(db: Database, id: number): Monitor | undefined {
  const row = db.prepare("SELECT * FROM monitors WHERE id = ?").get(id) as MonitorRow | undefined;
  return row ? rowToMonitor(row) : undefined;
}

export function updateMonitor(db: Database, id: number, patch: MonitorPatch): Monitor | undefined {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [field, column] of Object.entries(COLUMNS)) {
    const value = patch[field as keyof MonitorPatch];
    if (value === undefined) {
      continue;
    }
    assignments.push(`${column} = ?`);
    values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
  }

  if (assignments.length === 0) {
    return getMonitor(db, id);
  }

  const result = db
    .prepare(`UPDATE monitors SET ${assignments.join(", ")} WHERE id = ?`)
    .run(...values, id);

  return result.changes > 0 ? getMonitor(db, id) : undefined;
}

export function removeMonitor(db: Database, id: number): boolean {
  return db.prepare("DELETE FROM monitors WHERE id = ?").run(id).changes > 0;
}

export function setMonitorEnabled(db: Database, id: number, enabled: boolean): boolean {
  return (
    db.prepare("UPDATE monitors SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id).changes > 0
  );
}

export function setCertExpiry(db: Database, id: number, expiresAt: string | null): void {
  db.prepare("UPDATE monitors SET cert_expires_at = ? WHERE id = ?").run(expiresAt, id);
}
