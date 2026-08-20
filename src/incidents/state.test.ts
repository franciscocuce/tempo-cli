import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { addMonitor, type Monitor, type NewMonitor } from "../store/monitors.js";
import { getOpenIncident, listIncidents } from "../store/incidents.js";
import { recordCheck, humanDuration, certAlert } from "./state.js";
import type { CheckOutcome } from "../checks/types.js";

const sample: NewMonitor = {
  name: "portfolio",
  url: "https://franciscocuce.dev",
  method: "GET",
  cron: "* * * * *",
  expectedStatus: "2xx",
  keyword: null,
  keywordMode: "contains",
  timeoutMs: 10_000,
  followRedirects: true,
  confirmThreshold: 2,
  isPublic: true,
};

const up: CheckOutcome = { ok: true, httpStatus: 200, latencyMs: 120, error: null };
const down: CheckOutcome = {
  ok: false,
  httpStatus: 500,
  latencyMs: 90,
  error: "Se esperaba 2xx y respondió 500",
};

function at(minute: number): Date {
  return new Date(Date.UTC(2026, 7, 20, 12, minute));
}

describe("humanDuration", () => {
  it("redondea a minutos", () => {
    expect(humanDuration(20_000)).toBe("menos de un minuto");
    expect(humanDuration(5 * 60_000)).toBe("5 min");
  });

  it("pasa a horas", () => {
    expect(humanDuration(60 * 60_000)).toBe("1 h");
    expect(humanDuration(95 * 60_000)).toBe("1 h 35 min");
  });

  it("pasa a días", () => {
    expect(humanDuration(26 * 60 * 60_000)).toBe("1 d 2 h");
    expect(humanDuration(48 * 60 * 60_000)).toBe("2 d");
  });
});

describe("máquina de estados de incidentes", () => {
  let db: Database;
  let monitor: Monitor;

  beforeEach(() => {
    db = openDb(":memory:");
    monitor = addMonitor(db, sample);
  });

  it("un chequeo bueno no abre nada", () => {
    const transition = recordCheck(db, monitor, up, at(0));
    expect(transition.opened).toBe(false);
    expect(transition.alert).toBeNull();
    expect(getOpenIncident(db, monitor.id)).toBeUndefined();
  });

  it("un solo fallo no alcanza con umbral 2", () => {
    const transition = recordCheck(db, monitor, down, at(0));
    expect(transition.opened).toBe(false);
    expect(transition.alert).toBeNull();
    expect(getOpenIncident(db, monitor.id)).toBeUndefined();
  });

  it("dos fallos seguidos abren el incidente y avisan", () => {
    recordCheck(db, monitor, down, at(0));
    const transition = recordCheck(db, monitor, down, at(1));

    expect(transition.opened).toBe(true);
    expect(transition.alert?.kind).toBe("down");
    expect(transition.alert?.detail).toContain("500");
    expect(getOpenIncident(db, monitor.id)).toBeDefined();
  });

  it("el incidente arranca en el primer fallo, no en el que lo confirma", () => {
    recordCheck(db, monitor, down, at(0));
    recordCheck(db, monitor, down, at(1));

    expect(getOpenIncident(db, monitor.id)?.startedAt).toBe(at(0).toISOString());
  });

  it("un chequeo bueno en el medio corta la racha", () => {
    recordCheck(db, monitor, down, at(0));
    recordCheck(db, monitor, up, at(1));
    const transition = recordCheck(db, monitor, down, at(2));

    expect(transition.opened).toBe(false);
    expect(getOpenIncident(db, monitor.id)).toBeUndefined();
  });

  it("no vuelve a avisar mientras el incidente sigue abierto", () => {
    recordCheck(db, monitor, down, at(0));
    recordCheck(db, monitor, down, at(1));
    const tercero = recordCheck(db, monitor, down, at(2));

    expect(tercero.opened).toBe(false);
    expect(tercero.alert).toBeNull();
    expect(listIncidents(db)).toHaveLength(1);
  });

  it("cuenta los fallos del incidente", () => {
    recordCheck(db, monitor, down, at(0));
    recordCheck(db, monitor, down, at(1));
    recordCheck(db, monitor, down, at(2));

    expect(getOpenIncident(db, monitor.id)?.failedChecks).toBe(3);
  });

  it("al recuperarse cierra el incidente y avisa cuánto estuvo caído", () => {
    recordCheck(db, monitor, down, at(0));
    recordCheck(db, monitor, down, at(1));
    const transition = recordCheck(db, monitor, up, at(31));

    expect(transition.resolved).toBe(true);
    expect(transition.alert?.kind).toBe("up");
    expect(transition.alert?.detail).toContain("31 min");
    expect(getOpenIncident(db, monitor.id)).toBeUndefined();
  });

  it("con umbral 1 avisa al primer fallo", () => {
    const rapido = addMonitor(db, { ...sample, name: "rapido", confirmThreshold: 1 });
    const transition = recordCheck(db, rapido, down, at(0));

    expect(transition.opened).toBe(true);
    expect(transition.alert?.kind).toBe("down");
  });

  it("el estado sobrevive porque sale de la base, no de memoria", () => {
    recordCheck(db, monitor, down, at(0));
    recordCheck(db, monitor, down, at(1));

    // otra "sesión" leyendo la misma base ve el incidente abierto
    expect(getOpenIncident(db, monitor.id)?.failedChecks).toBe(2);
    const recuperado = recordCheck(db, monitor, up, at(2));
    expect(recuperado.resolved).toBe(true);
  });

  it("devuelve el resultado del chequeo junto con la transición", () => {
    const transition = recordCheck(db, monitor, up, at(0));
    expect(transition.outcome.latencyMs).toBe(120);
    expect(transition.checkId).toBe(1);
  });
});

describe("certAlert", () => {
  it("avisa los días que faltan", () => {
    const monitor = { name: "portfolio", url: "https://x.dev" } as Monitor;
    expect(certAlert(monitor, 7).detail).toContain("vence en 7 días");
  });

  it("avisa si ya venció", () => {
    const monitor = { name: "portfolio", url: "https://x.dev" } as Monitor;
    expect(certAlert(monitor, -3).detail).toContain("venció hace 3 días");
  });
});
