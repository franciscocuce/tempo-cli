import type { Database } from "better-sqlite3";

export interface Uptime {
  total: number;
  failed: number;
  percent: number | null;
}

export interface DayStat {
  day: string;
  total: number;
  failed: number;
  percent: number | null;
  avgLatency: number | null;
}

export interface MonitorStats {
  uptime24h: Uptime;
  uptime7d: Uptime;
  uptime30d: Uptime;
  p50: number | null;
  p95: number | null;
  history: DayStat[];
}

// los días se agrupan en UTC: las fechas se guardan en ISO, así que el prefijo ya es el día
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

function toUptime(total: number, failed: number): Uptime {
  return {
    total,
    failed,
    percent: total === 0 ? null : Math.round(((total - failed) / total) * 10_000) / 100,
  };
}

export function uptimeSince(db: Database, monitorId: number, since: Date): Uptime {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed
         FROM checks
        WHERE monitor_id = ? AND checked_at >= ?`,
    )
    .get(monitorId, since.toISOString()) as { total: number; failed: number | null };

  return toUptime(row.total, row.failed ?? 0);
}

export function latencyPercentiles(
  db: Database,
  monitorId: number,
  since: Date,
): { p50: number | null; p95: number | null } {
  const rows = db
    .prepare(
      `SELECT latency_ms FROM checks
        WHERE monitor_id = ? AND checked_at >= ? AND ok = 1`,
    )
    .all(monitorId, since.toISOString()) as { latency_ms: number }[];

  const values = rows.map((r) => r.latency_ms);
  return { p50: percentile(values, 50), p95: percentile(values, 95) };
}

// la ventana larga se arma con el resumen diario más lo que va del día de hoy,
// que todavía no se resumió
export function dailyHistory(db: Database, monitorId: number, days: number, now: Date): DayStat[] {
  const first = new Date(now.getTime() - (days - 1) * 86_400_000);

  const rolled = db
    .prepare(
      `SELECT day, total, failed, avg_latency
         FROM checks_daily
        WHERE monitor_id = ? AND day >= ?`,
    )
    .all(monitorId, utcDay(first)) as {
    day: string;
    total: number;
    failed: number;
    avg_latency: number;
  }[];

  const byDay = new Map<string, DayStat>();
  for (const row of rolled) {
    byDay.set(row.day, {
      day: row.day,
      total: row.total,
      failed: row.failed,
      percent: toUptime(row.total, row.failed).percent,
      avgLatency: row.avg_latency,
    });
  }

  for (const row of rawDays(db, monitorId, utcDay(first))) {
    byDay.set(row.day, row);
  }

  const history: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = utcDay(new Date(now.getTime() - i * 86_400_000));
    history.push(byDay.get(day) ?? { day, total: 0, failed: 0, percent: null, avgLatency: null });
  }

  return history;
}

function rawDays(db: Database, monitorId: number, fromDay: string): DayStat[] {
  const rows = db
    .prepare(
      `SELECT substr(checked_at, 1, 10) AS day,
              COUNT(*) AS total,
              SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed,
              CAST(AVG(latency_ms) AS INTEGER) AS avg_latency
         FROM checks
        WHERE monitor_id = ? AND substr(checked_at, 1, 10) >= ?
        GROUP BY day`,
    )
    .all(monitorId, fromDay) as {
    day: string;
    total: number;
    failed: number;
    avg_latency: number;
  }[];

  return rows.map((row) => ({
    day: row.day,
    total: row.total,
    failed: row.failed,
    percent: toUptime(row.total, row.failed).percent,
    avgLatency: row.avg_latency,
  }));
}

function fromHistory(history: DayStat[]): Uptime {
  let total = 0;
  let failed = 0;
  for (const day of history) {
    total += day.total;
    failed += day.failed;
  }
  return toUptime(total, failed);
}

export function monitorStats(
  db: Database,
  monitorId: number,
  now: Date = new Date(),
  historyDays = 90,
): MonitorStats {
  const since24h = new Date(now.getTime() - 86_400_000);
  const history = dailyHistory(db, monitorId, historyDays, now);

  return {
    uptime24h: uptimeSince(db, monitorId, since24h),
    uptime7d: fromHistory(history.slice(-7)),
    uptime30d: fromHistory(history.slice(-30)),
    ...latencyPercentiles(db, monitorId, since24h),
    history,
  };
}
