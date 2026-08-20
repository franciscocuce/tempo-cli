import type { Database } from "better-sqlite3";
import { percentile, utcDay } from "./stats.js";

export const RAW_RETENTION_DAYS = 7;
export const DAILY_RETENTION_DAYS = 400;

export interface MaintenanceReport {
  rolledDays: number;
  prunedChecks: number;
  prunedDays: number;
}

// un chequeo por minuto son medio millón de filas por año y por monitor: los días cerrados
// se resumen en checks_daily y las filas crudas se tiran
export function rollupDay(db: Database, day: string): number {
  const rows = db
    .prepare(
      `SELECT monitor_id, ok, latency_ms
         FROM checks
        WHERE substr(checked_at, 1, 10) = ?`
    )
    .all(day) as { monitor_id: number; ok: number; latency_ms: number }[];

  if (rows.length === 0) {
    return 0;
  }

  const byMonitor = new Map<number, { total: number; failed: number; latencies: number[] }>();

  for (const row of rows) {
    let bucket = byMonitor.get(row.monitor_id);
    if (bucket === undefined) {
      bucket = { total: 0, failed: 0, latencies: [] };
      byMonitor.set(row.monitor_id, bucket);
    }
    bucket.total += 1;
    if (row.ok === 0) {
      bucket.failed += 1;
    } else {
      bucket.latencies.push(row.latency_ms);
    }
  }

  const insert = db.prepare(
    `INSERT INTO checks_daily (monitor_id, day, total, failed, avg_latency, p95_latency)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (monitor_id, day) DO UPDATE SET
       total = excluded.total,
       failed = excluded.failed,
       avg_latency = excluded.avg_latency,
       p95_latency = excluded.p95_latency`
  );

  db.transaction(() => {
    for (const [monitorId, bucket] of byMonitor) {
      const sum = bucket.latencies.reduce((acc, value) => acc + value, 0);
      const avg = bucket.latencies.length === 0 ? 0 : Math.round(sum / bucket.latencies.length);
      insert.run(
        monitorId,
        day,
        bucket.total,
        bucket.failed,
        avg,
        percentile(bucket.latencies, 95) ?? 0
      );
    }
  })();

  return byMonitor.size;
}

export function pendingDays(db: Database, now: Date): string[] {
  const today = utcDay(now);

  const rows = db
    .prepare(
      `SELECT DISTINCT substr(checked_at, 1, 10) AS day
         FROM checks
        WHERE substr(checked_at, 1, 10) < ?
        ORDER BY day`
    )
    .all(today) as { day: string }[];

  return rows.map((row) => row.day);
}

export function pruneChecks(db: Database, now: Date, days = RAW_RETENTION_DAYS): number {
  const cutoff = utcDay(new Date(now.getTime() - days * 86_400_000));
  return db.prepare("DELETE FROM checks WHERE substr(checked_at, 1, 10) < ?").run(cutoff).changes;
}

export function pruneDailyStats(db: Database, now: Date, days = DAILY_RETENTION_DAYS): number {
  const cutoff = utcDay(new Date(now.getTime() - days * 86_400_000));
  return db.prepare("DELETE FROM checks_daily WHERE day < ?").run(cutoff).changes;
}

export function runMaintenance(db: Database, now: Date = new Date()): MaintenanceReport {
  let rolledDays = 0;
  for (const day of pendingDays(db, now)) {
    rollupDay(db, day);
    rolledDays += 1;
  }

  return {
    rolledDays,
    prunedChecks: pruneChecks(db, now),
    prunedDays: pruneDailyStats(db, now),
  };
}
