import { Router } from "express";
import type { Database } from "better-sqlite3";
import { listPublicMonitors } from "../store/monitors.js";
import { lastCheck } from "../store/checks.js";
import { getOpenIncident, listIncidents } from "../store/incidents.js";
import { monitorStats, utcDay } from "../store/stats.js";

export const HISTORY_DAYS = 90;
const RECENT_INCIDENTS = 10;

export function publicStatusOf(enabled: boolean, down: boolean, checked: boolean): string {
  if (!enabled) {
    return "paused";
  }
  if (!checked) {
    return "pending";
  }
  return down ? "down" : "up";
}

// lo único que se sirve sin sesión. No sale ni la URL ni la configuración interna:
// solo el nombre, el estado y los números de disponibilidad
export function createPublicRouter(db: Database): Router {
  const router = Router();

  router.get("/status", (_req, res) => {
    const now = new Date();
    const monitors = listPublicMonitors(db);
    const publicIds = new Set(monitors.map((monitor) => monitor.id));

    res.json({
      generatedAt: now.toISOString(),
      from: utcDay(new Date(now.getTime() - (HISTORY_DAYS - 1) * 86_400_000)),
      days: HISTORY_DAYS,
      monitors: monitors.map((monitor) => {
        const stats = monitorStats(db, monitor.id, now, HISTORY_DAYS);
        const last = lastCheck(db, monitor.id);
        const open = getOpenIncident(db, monitor.id);

        return {
          name: monitor.name,
          status: publicStatusOf(monitor.enabled, open !== undefined, last !== undefined),
          uptime24h: stats.uptime24h.percent,
          uptime30d: stats.uptime30d.percent,
          p95: stats.p95,
          days: stats.history.map((day) => day.percent),
        };
      }),
      incidents: listIncidents(db, { limit: RECENT_INCIDENTS })
        .filter((incident) => publicIds.has(incident.monitorId))
        .map((incident) => ({
          monitorName: incident.monitorName,
          startedAt: incident.startedAt,
          resolvedAt: incident.resolvedAt,
          durationMs: incident.durationMs,
        })),
    });
  });

  return router;
}
