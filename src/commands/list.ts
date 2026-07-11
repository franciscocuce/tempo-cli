import { openDb } from "../db/connection.js";
import { listTasks } from "../store/tasks.js";
import { parseExpression, nextRun } from "../cron/index.js";

export function list(): void {
  const db = openDb();
  try {
    const tasks = listTasks(db);

    if (tasks.length === 0) {
      console.log("No hay tareas. Agregá una con: tempo add");
      return;
    }

    const now = new Date();
    const rows = tasks.map((task) => ({
      id: task.id,
      nombre: task.name,
      cron: task.cron,
      tipo: task.type,
      estado: task.enabled ? "activa" : "pausada",
      próximo: task.enabled
        ? nextRun(parseExpression(task.cron), now).toLocaleString()
        : "—",
    }));

    console.table(rows);
  } finally {
    db.close();
  }
}
