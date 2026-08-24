import type { Database } from "better-sqlite3";
import type { CheckOutcome } from "../checks/types.js";
import type { Monitor } from "../store/monitors.js";
import { addCheck, recentChecks } from "../store/checks.js";
import {
  bumpFailedChecks,
  getOpenIncident,
  openIncident,
  resolveIncident,
} from "../store/incidents.js";
import type { Alert } from "../notify/types.js";

export interface Transition {
  checkId: number;
  outcome: CheckOutcome;
  opened: boolean;
  resolved: boolean;
  alert: Alert | null;
}

export function humanDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);

  if (minutes < 1) {
    return "menos de un minuto";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours < 24) {
    return restMinutes === 0 ? `${hours} h` : `${hours} h ${restMinutes} min`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}

// el estado sale de la base y no de memoria, así un reinicio del daemon
// no se olvida de que había algo caído
export function recordCheck(
  db: Database,
  monitor: Monitor,
  outcome: CheckOutcome,
  at: Date = new Date(),
): Transition {
  const checkedAt = at.toISOString();

  const checkId = addCheck(db, {
    monitorId: monitor.id,
    checkedAt,
    ok: outcome.ok,
    httpStatus: outcome.httpStatus,
    latencyMs: outcome.latencyMs,
    error: outcome.error,
  });

  const open = getOpenIncident(db, monitor.id);

  if (outcome.ok) {
    if (open === undefined) {
      return { checkId, outcome, opened: false, resolved: false, alert: null };
    }

    resolveIncident(db, open.id, checkedAt);
    const downtime = at.getTime() - new Date(open.startedAt).getTime();

    return {
      checkId,
      outcome,
      opened: false,
      resolved: true,
      alert: {
        kind: "up",
        monitorName: monitor.name,
        url: monitor.url,
        detail: `Volvió después de ${humanDuration(downtime)} caído`,
        at,
      },
    };
  }

  if (open !== undefined) {
    bumpFailedChecks(db, open.id);
    return { checkId, outcome, opened: false, resolved: false, alert: null };
  }

  const window = recentChecks(db, monitor.id, monitor.confirmThreshold);
  const confirmed = window.length >= monitor.confirmThreshold && window.every((check) => !check.ok);

  if (!confirmed) {
    return { checkId, outcome, opened: false, resolved: false, alert: null };
  }

  const cause = outcome.error ?? "Sin respuesta";
  // el incidente arranca en el primer fallo, no en el que lo confirma
  openIncident(db, monitor.id, window[0].checkedAt, cause, window.length);

  return {
    checkId,
    outcome,
    opened: true,
    resolved: false,
    alert: {
      kind: "down",
      monitorName: monitor.name,
      url: monitor.url,
      detail: cause,
      at,
    },
  };
}

export function certAlert(monitor: Monitor, daysLeft: number, at: Date = new Date()): Alert {
  const detail =
    daysLeft < 0
      ? `El certificado venció hace ${Math.abs(daysLeft)} días`
      : `El certificado vence en ${daysLeft} días`;

  return { kind: "cert", monitorName: monitor.name, url: monitor.url, detail, at };
}
