import { openDb } from "../db/connection.js";
import { listTasks } from "../store/tasks.js";
import { taskNextRun } from "../scheduler/next-run.js";

export function list(): void {
  const db = openDb();
  try {
    const tasks = listTasks(db);

    if (tasks.length === 0) {
      console.log("No hay tareas. Agregá una con: tempo add");
      return;
    }

    const now = new Date();
    const rows = tasks.map((task) => {
      const next = taskNextRun(task, now);
      return {
        id: task.id,
        nombre: task.name,
        cron: task.cron,
        tipo: task.type,
        estado: task.enabled ? "activa" : "pausada",
        próximo: next ? next.toLocaleString() : "—",
      };
    });

    console.table(rows);
  } finally {
    db.close();
  }
}
