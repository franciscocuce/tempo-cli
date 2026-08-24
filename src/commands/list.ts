import { openDb } from "../db/connection.js";
import { listMonitors } from "../store/monitors.js";
import { lastCheck } from "../store/checks.js";
import { getOpenIncident } from "../store/incidents.js";
import { uptimeSince } from "../store/stats.js";
import { monitorNextRun } from "../scheduler/next-run.js";

export function list(): void {
  const db = openDb();
  try {
    const monitors = listMonitors(db);

    if (monitors.length === 0) {
      console.log("No hay monitores. Agregá uno con: tempo add --name ... --url ... --cron ...");
      return;
    }

    const now = new Date();
    const since = new Date(now.getTime() - 86_400_000);

    const rows = monitors.map((monitor) => {
      const next = monitorNextRun(monitor, now);
      const last = lastCheck(db, monitor.id);
      const uptime = uptimeSince(db, monitor.id, since);

      return {
        id: monitor.id,
        nombre: monitor.name,
        url: monitor.url,
        cron: monitor.cron,
        estado: state(
          monitor.enabled,
          getOpenIncident(db, monitor.id) !== undefined,
          last !== undefined,
        ),
        "uptime 24h": uptime.percent === null ? "—" : `${uptime.percent}%`,
        latencia: last === undefined ? "—" : `${last.latencyMs}ms`,
        próximo: next === null ? "—" : next.toLocaleTimeString(),
      };
    });

    console.table(rows);
  } finally {
    db.close();
  }
}

function state(enabled: boolean, down: boolean, checked: boolean): string {
  if (!enabled) {
    return "pausado";
  }
  if (!checked) {
    return "sin datos";
  }
  return down ? "CAÍDO" : "ok";
}
