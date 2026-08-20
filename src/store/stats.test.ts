import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { addMonitor, type NewMonitor } from "./monitors.js";
import { addCheck } from "./checks.js";
import { percentile, utcDay, uptimeSince, latencyPercentiles, monitorStats } from "./stats.js";

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

const NOW = new Date("2026-08-20T12:00:00.000Z");

describe("percentile", () => {
  it("devuelve null con una lista vacía", () => {
    expect(percentile([], 95)).toBeNull();
  });

  it("saca la mediana", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it("saca el p95", () => {
    expect(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(95);
  });

  it("no depende del orden de entrada", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
  });
});

describe("utcDay", () => {
  it("se queda con la fecha", () => {
    expect(utcDay(new Date("2026-08-20T23:59:59.000Z"))).toBe("2026-08-20");
  });
});

describe("estadísticas", () => {
  let db: Database;
  let monitorId: number;

  beforeEach(() => {
    db = openDb(":memory:");
    monitorId = addMonitor(db, sample).id;
  });

  function check(ok: boolean, latencyMs: number, minutesAgo: number): void {
    addCheck(db, {
      monitorId,
      checkedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
      ok,
      httpStatus: ok ? 200 : 500,
      latencyMs,
      error: ok ? null : "boom",
    });
  }

  it("sin datos el uptime es null", () => {
    const uptime = uptimeSince(db, monitorId, new Date(NOW.getTime() - 86_400_000));
    expect(uptime.total).toBe(0);
    expect(uptime.percent).toBeNull();
  });

  it("calcula el porcentaje de uptime", () => {
    for (let i = 0; i < 9; i++) {
      check(true, 100, i);
    }
    check(false, 0, 9);

    const uptime = uptimeSince(db, monitorId, new Date(NOW.getTime() - 86_400_000));
    expect(uptime.total).toBe(10);
    expect(uptime.failed).toBe(1);
    expect(uptime.percent).toBe(90);
  });

  it("deja el uptime con dos decimales", () => {
    for (let i = 0; i < 999; i++) {
      check(true, 100, i);
    }
    check(false, 0, 999);

    const uptime = uptimeSince(db, monitorId, new Date(NOW.getTime() - 7 * 86_400_000));
    expect(uptime.percent).toBe(99.9);
  });

  it("ignora lo que quedó fuera de la ventana", () => {
    check(true, 100, 10);
    check(false, 0, 60 * 48);

    const uptime = uptimeSince(db, monitorId, new Date(NOW.getTime() - 86_400_000));
    expect(uptime.total).toBe(1);
    expect(uptime.percent).toBe(100);
  });

  it("los percentiles solo miran los chequeos que anduvieron", () => {
    check(true, 100, 1);
    check(true, 200, 2);
    check(false, 9999, 3);

    const { p50, p95 } = latencyPercentiles(db, monitorId, new Date(NOW.getTime() - 86_400_000));
    expect(p50).toBe(100);
    expect(p95).toBe(200);
  });

  it("arma el historial con un punto por día", () => {
    check(true, 100, 5);
    check(false, 0, 60 * 24 + 5);

    const stats = monitorStats(db, monitorId, NOW, 7);
    expect(stats.history).toHaveLength(7);
    expect(stats.history[6].day).toBe("2026-08-20");
    expect(stats.history[6].percent).toBe(100);
    expect(stats.history[5].day).toBe("2026-08-19");
    expect(stats.history[5].percent).toBe(0);
  });

  it("los días sin datos quedan en null", () => {
    check(true, 100, 5);
    const stats = monitorStats(db, monitorId, NOW, 7);
    expect(stats.history[0].percent).toBeNull();
    expect(stats.history[0].total).toBe(0);
  });

  it("la ventana de 7 días suma los días del historial", () => {
    check(true, 100, 5);
    check(false, 0, 60 * 24 + 5);

    const stats = monitorStats(db, monitorId, NOW, 90);
    expect(stats.uptime7d.total).toBe(2);
    expect(stats.uptime7d.percent).toBe(50);
  });
});
