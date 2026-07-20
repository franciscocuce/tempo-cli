import { openDb } from "../db/connection.js";
import { listTasks } from "../store/tasks.js";
import { startScheduler } from "../scheduler/loop.js";

export function start(): void {
  const db = openDb();
  const active = listTasks(db).filter((t) => t.enabled).length;

  console.log(`tempo iniciado — ${active} tarea(s) activa(s), tick cada minuto`);
  console.log("Ctrl+C para detener");

  const scheduler = startScheduler(db);

  process.on("SIGINT", () => {
    console.log("\nDeteniendo scheduler...");
    scheduler.stop();
    db.close();
    process.exit(0);
  });
}
