import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { addMonitor, type NewMonitor } from "./monitors.js";
import { addCheck, listChecks } from "./checks.js";
import { monitorStats } from "./stats.js";
import { rollupDay, pendingDays, pruneChecks, runMaintenance } from "./retention.js";

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

describe("retención", () => {
  let db: Database;
  let monitorId: number;

  beforeEach(() => {
    db = openDb(":memory:");
    monitorId = addMonitor(db, sample).id;
  });

  function check(day: string, hour: number, ok: boolean, latencyMs: number): void {
    addCheck(db, {
      monitorId,
      checkedAt: `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`,
      ok,
      httpStatus: ok ? 200 : 500,
      latencyMs,
      error: ok ? null : "boom",
    });
  }

  function dailyRow(day: string) {
    return db
      .prepare("SELECT * FROM checks_daily WHERE monitor_id = ? AND day = ?")
      .get(monitorId, day) as
      { total: number; failed: number; avg_latency: number; p95_latency: number } | undefined;
  }

  it("resume un día en una fila", () => {
    check("2026-08-18", 1, true, 100);
    check("2026-08-18", 2, true, 200);
    check("2026-08-18", 3, false, 0);

    rollupDay(db, "2026-08-18");

    const row = dailyRow("2026-08-18");
    expect(row?.total).toBe(3);
    expect(row?.failed).toBe(1);
    expect(row?.avg_latency).toBe(150);
  });

  it("volver a resumir el mismo día no duplica", () => {
    check("2026-08-18", 1, true, 100);
    rollupDay(db, "2026-08-18");
    rollupDay(db, "2026-08-18");

    const rows = db
      .prepare("SELECT COUNT(*) AS total FROM checks_daily WHERE day = ?")
      .get("2026-08-18") as { total: number };
    expect(rows.total).toBe(1);
  });

  it("resume cada monitor por separado", () => {
    const otro = addMonitor(db, { ...sample, name: "blog" }).id;
    check("2026-08-18", 1, true, 100);
    addCheck(db, {
      monitorId: otro,
      checkedAt: "2026-08-18T01:00:00.000Z",
      ok: false,
      httpStatus: 500,
      latencyMs: 0,
      error: "boom",
    });

    expect(rollupDay(db, "2026-08-18")).toBe(2);
  });

  it("pendingDays no incluye el día de hoy", () => {
    check("2026-08-18", 1, true, 100);
    check("2026-08-19", 1, true, 100);
    check("2026-08-20", 1, true, 100);

    expect(pendingDays(db, NOW)).toEqual(["2026-08-18", "2026-08-19"]);
  });

  it("prune borra lo más viejo que la ventana y deja lo reciente", () => {
    check("2026-08-01", 1, true, 100);
    check("2026-08-19", 1, true, 100);

    expect(pruneChecks(db, NOW, 7)).toBe(1);
    expect(listChecks(db)).toHaveLength(1);
  });

  it("el mantenimiento resume y después borra, sin perder el uptime", () => {
    check("2026-08-01", 1, true, 100);
    check("2026-08-01", 2, false, 0);
    check("2026-08-20", 1, true, 150);

    const before = monitorStats(db, monitorId, NOW, 90);
    const report = runMaintenance(db, NOW);
    const after = monitorStats(db, monitorId, NOW, 90);

    expect(report.rolledDays).toBe(1);
    expect(report.prunedChecks).toBe(2);
    expect(listChecks(db)).toHaveLength(1);

    // los datos crudos del 1 de agosto ya no están, pero el día resumido sí
    const august1 = after.history.find((d) => d.day === "2026-08-01");
    expect(august1?.total).toBe(2);
    expect(august1?.percent).toBe(50);
    expect(after.history).toHaveLength(before.history.length);
  });
});
