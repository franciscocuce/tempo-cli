import type { Database } from "better-sqlite3";

export type RunStatus = "ok" | "error";

export interface Run {
  id: number;
  taskId: number;
  taskName: string;
  startedAt: string;
  durationMs: number;
  status: RunStatus;
  output: string;
}

export interface NewRun {
  taskId: number;
  startedAt: string;
  durationMs: number;
  status: RunStatus;
  output: string;
}

interface RunRow {
  id: number;
  task_id: number;
  task_name: string;
  started_at: string;
  duration_ms: number;
  status: RunStatus;
  output: string;
}

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    taskId: row.task_id,
    taskName: row.task_name,
    startedAt: row.started_at,
    durationMs: row.duration_ms,
    status: row.status,
    output: row.output,
  };
}

export function addRun(db: Database, run: NewRun): void {
  db.prepare(
    `INSERT INTO runs (task_id, started_at, duration_ms, status, output)
     VALUES (?, ?, ?, ?, ?)`
  ).run(run.taskId, run.startedAt, run.durationMs, run.status, run.output);
}

export interface ListRunsOptions {
  taskId?: number;
  limit?: number;
}

export function listRuns(db: Database, options: ListRunsOptions = {}): Run[] {
  const { taskId, limit = 20 } = options;

  const where = taskId !== undefined ? "WHERE runs.task_id = ?" : "";
  const params = taskId !== undefined ? [taskId, limit] : [limit];

  const rows = db
    .prepare(
      `SELECT runs.*, tasks.name AS task_name
       FROM runs
       JOIN tasks ON tasks.id = runs.task_id
       ${where}
       ORDER BY runs.id DESC
       LIMIT ?`
    )
    .all(...params) as RunRow[];

  return rows.map(rowToRun);
}
