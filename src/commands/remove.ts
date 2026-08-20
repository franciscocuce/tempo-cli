import { openDb } from "../db/connection.js";
import { removeMonitor } from "../store/monitors.js";
import { parseId } from "./parse-id.js";

export function remove(rawId: string): void {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const db = openDb();
  try {
    if (removeMonitor(db, id)) {
      console.log(`Monitor ${id} eliminado (con todo su historial)`);
      return;
    }
    console.error(`No existe un monitor con id ${id}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
