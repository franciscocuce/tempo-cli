import type { Database } from "better-sqlite3";

export type TaskType = "shell" | "http";

export interface Task {
  id: number;
  name: string;
  cron: string;
  type: TaskType;
  payload: string;
  enabled: boolean;
  createdAt: string;
}

export interface NewTask {
  name: string;
  cron: string;
  type: TaskType;
  payload: string;
}

// así vienen las filas crudas de sqlite (enabled es 0/1, no boolean)
interface TaskRow {
  id: number;
  name: string;
  cron: string;
  type: TaskType;
  payload: string;
  enabled: number;
  created_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    cron: row.cron,
    type: row.type,
    payload: row.payload,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

export function addTask(db: Database, input: NewTask): Task {
  const result = db
    .prepare(
      `INSERT INTO tasks (name, cron, type, payload, enabled, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`
    )
    .run(input.name, input.cron, input.type, input.payload, new Date().toISOString());

  return getTask(db, Number(result.lastInsertRowid))!;
}

export function listTasks(db: Database): Task[] {
  const rows = db.prepare("SELECT * FROM tasks ORDER BY id").all() as TaskRow[];
  return rows.map(rowToTask);
}

export function getTask(db: Database, id: number): Task | undefined {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | TaskRow
    | undefined;
  return row ? rowToTask(row) : undefined;
}

export function removeTask(db: Database, id: number): boolean {
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return result.changes > 0;
}

export function setTaskEnabled(db: Database, id: number, enabled: boolean): boolean {
  const result = db
    .prepare("UPDATE tasks SET enabled = ? WHERE id = ?")
    .run(enabled ? 1 : 0, id);
  return result.changes > 0;
}
