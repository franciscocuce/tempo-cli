import { openDb } from "../db/connection.js";
import { removeTask } from "../store/tasks.js";
import { parseId } from "./parse-id.js";

export function remove(rawId: string): void {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const db = openDb();
  try {
    if (removeTask(db, id)) {
      console.log(`Tarea ${id} eliminada`);
    } else {
      console.error(`No existe una tarea con id ${id}`);
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}
