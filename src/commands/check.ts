import { openDb } from "../db/connection.js";
import { getMonitor } from "../store/monitors.js";
import { checkMonitor } from "../scheduler/runner.js";
import { parseId } from "./parse-id.js";

export async function check(rawId: string): Promise<void> {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const db = openDb();
  try {
    const monitor = getMonitor(db, id);
    if (monitor === undefined) {
      console.error(`No existe un monitor con id ${id}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Chequeando ${monitor.url} ...`);
    const { outcome, opened, resolved } = await checkMonitor(db, monitor);

    const status = outcome.httpStatus === null ? "sin respuesta" : `HTTP ${outcome.httpStatus}`;
    console.log(`${outcome.ok ? "OK" : "FALLÓ"} — ${status} en ${outcome.latencyMs}ms`);

    if (outcome.error !== null) {
      console.log(outcome.error);
    }
    if (opened) {
      console.log("Se abrió un incidente y se avisó por los canales configurados");
    }
    if (resolved) {
      console.log("Se cerró el incidente que estaba abierto");
    }

    process.exitCode = outcome.ok ? 0 : 1;
  } finally {
    db.close();
  }
}
