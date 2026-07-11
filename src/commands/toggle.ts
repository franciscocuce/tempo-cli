import { openDb } from "../db/connection.js";
import { setTaskEnabled } from "../store/tasks.js";
import { parseId } from "./parse-id.js";

export function toggle(rawId: string, enabled: boolean): void {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const db = openDb();
  try {
    if (setTaskEnabled(db, id, enabled)) {
      console.log(`Tarea ${id} ${enabled ? "activada" : "pausada"}`);
    } else {
      console.error(`No existe una tarea con id ${id}`);
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}
