export type TaskType = "shell" | "http";

export interface Task {
  id: number;
  name: string;
  cron: string;
  type: TaskType;
  payload: string;
  enabled: boolean;
  createdAt: string;
  nextRun: string | null;
}

export interface Run {
  id: number;
  taskId: number;
  taskName: string;
  startedAt: string;
  durationMs: number;
  status: "ok" | "error";
  output: string;
}

export interface NewTaskInput {
  name: string;
  cron: string;
  type: TaskType;
  command?: string;
  url?: string;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}

export function getTasks(): Promise<Task[]> {
  return fetch("/api/tasks").then((r) => asJson<Task[]>(r));
}

export function getRuns(): Promise<Run[]> {
  return fetch("/api/runs").then((r) => asJson<Run[]>(r));
}

export function createTask(input: NewTaskInput): Promise<Task> {
  return fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => asJson<Task>(r));
}

export function setEnabled(id: number, enabled: boolean): Promise<Task> {
  return fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  }).then((r) => asJson<Task>(r));
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Error ${res.status}`);
  }
}

export function runTask(id: number): Promise<{ status: string; durationMs: number; output: string }> {
  return fetch(`/api/tasks/${id}/run`, { method: "POST" }).then((r) => asJson(r));
}
