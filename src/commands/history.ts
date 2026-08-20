import { openDb } from "../db/connection.js";
import { listChecks } from "../store/checks.js";
import { parseId } from "./parse-id.js";

const ERROR_PREVIEW_CHARS = 60;

interface HistoryOptions {
  monitor?: string;
  limit?: string;
}

export function history(options: HistoryOptions): void {
  let monitorId: number | undefined;
  if (options.monitor !== undefined) {
    monitorId = parseId(options.monitor);
    if (monitorId === undefined) {
      return;
    }
  }

  const db = openDb();
  try {
    const checks = listChecks(db, { monitorId, limit: Number(options.limit ?? 20) });

    if (checks.length === 0) {
      console.log("Todavía no hay chequeos registrados");
      return;
    }

    const rows = checks.map((check) => ({
      fecha: new Date(check.checkedAt).toLocaleString(),
      monitor: check.monitorName,
      estado: check.ok ? "ok" : "FALLÓ",
      http: check.httpStatus ?? "—",
      latencia: `${check.latencyMs}ms`,
      detalle: (check.error ?? "").replace(/\s+/g, " ").slice(0, ERROR_PREVIEW_CHARS),
    }));

    console.table(rows);
  } finally {
    db.close();
  }
}
