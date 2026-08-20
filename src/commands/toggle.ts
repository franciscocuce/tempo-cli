import { openDb } from "../db/connection.js";
import { setMonitorEnabled } from "../store/monitors.js";
import { parseId } from "./parse-id.js";

export function toggle(rawId: string, enabled: boolean): void {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const db = openDb();
  try {
    if (setMonitorEnabled(db, id, enabled)) {
      console.log(`Monitor ${id} ${enabled ? "activado" : "pausado"}`);
      return;
    }
    console.error(`No existe un monitor con id ${id}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
