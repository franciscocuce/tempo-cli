import { openDb } from "../db/connection.js";
import { listIncidents } from "../store/incidents.js";
import { humanDuration } from "../incidents/state.js";
import { parseId } from "./parse-id.js";

interface IncidentsOptions {
  monitor?: string;
  limit?: string;
  open?: boolean;
}

export function incidents(options: IncidentsOptions): void {
  let monitorId: number | undefined;
  if (options.monitor !== undefined) {
    monitorId = parseId(options.monitor);
    if (monitorId === undefined) {
      return;
    }
  }

  const db = openDb();
  try {
    const found = listIncidents(db, {
      monitorId,
      limit: Number(options.limit ?? 20),
      onlyOpen: options.open === true,
    });

    if (found.length === 0) {
      console.log(options.open === true ? "No hay incidentes abiertos" : "No hay incidentes");
      return;
    }

    const now = Date.now();

    const rows = found.map((incident) => ({
      id: incident.id,
      monitor: incident.monitorName,
      desde: new Date(incident.startedAt).toLocaleString(),
      "duración":
        incident.durationMs === null
          ? `${humanDuration(now - new Date(incident.startedAt).getTime())} (en curso)`
          : humanDuration(incident.durationMs),
      fallos: incident.failedChecks,
      causa: incident.cause.replace(/\s+/g, " ").slice(0, 50),
    }));

    console.table(rows);
  } finally {
    db.close();
  }
}
