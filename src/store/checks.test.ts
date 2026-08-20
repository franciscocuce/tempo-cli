import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { addMonitor, removeMonitor, type NewMonitor } from "./monitors.js";
import {
  addCheck,
  listChecks,
  recentChecks,
  lastCheck,
  clampLimit,
  MAX_LIMIT,
  DEFAULT_LIMIT,
} from "./checks.js";

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

function insert(db: Database, monitorId: number, ok: boolean, minuteOffset: number): void {
  addCheck(db, {
    monitorId,
    checkedAt: new Date(Date.UTC(2026, 7, 20, 12, minuteOffset)).toISOString(),
    ok,
    httpStatus: ok ? 200 : 500,
    latencyMs: 100 + minuteOffset,
    error: ok ? null : "boom",
  });
}

describe("clampLimit", () => {
  it("usa el default cuando no le pasan nada usable", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(clampLimit("hola")).toBe(DEFAULT_LIMIT);
    expect(clampLimit(0)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(-5)).toBe(DEFAULT_LIMIT);
  });

  it("corta los pedidos exagerados", () => {
    expect(clampLimit(999_999_999)).toBe(MAX_LIMIT);
  });

  it("respeta un límite razonable", () => {
    expect(clampLimit(10)).toBe(10);
  });
});

describe("store de chequeos", () => {
  let db: Database;
  let monitorId: number;

  beforeEach(() => {
    db = openDb(":memory:");
    monitorId = addMonitor(db, sample).id;
  });

  it("guarda un chequeo y lo trae con el nombre del monitor", () => {
    insert(db, monitorId, true, 0);
    const [check] = listChecks(db, { monitorId });

    expect(check.monitorName).toBe("portfolio");
    expect(check.ok).toBe(true);
    expect(check.httpStatus).toBe(200);
    expect(check.error).toBeNull();
  });

  it("lista del más nuevo al más viejo", () => {
    insert(db, monitorId, true, 0);
    insert(db, monitorId, false, 1);
    expect(listChecks(db, { monitorId }).map((c) => c.ok)).toEqual([false, true]);
  });

  it("recentChecks los devuelve del más viejo al más nuevo", () => {
    insert(db, monitorId, true, 0);
    insert(db, monitorId, false, 1);
    insert(db, monitorId, false, 2);

    expect(recentChecks(db, monitorId, 2).map((c) => c.latencyMs)).toEqual([101, 102]);
  });

  it("lastCheck devuelve el último", () => {
    insert(db, monitorId, true, 0);
    insert(db, monitorId, false, 5);
    expect(lastCheck(db, monitorId)?.latencyMs).toBe(105);
  });

  it("lastCheck es undefined si no hay nada", () => {
    expect(lastCheck(db, monitorId)).toBeUndefined();
  });

  it("filtra por monitor", () => {
    const otro = addMonitor(db, { ...sample, name: "blog" }).id;
    insert(db, monitorId, true, 0);
    insert(db, otro, true, 1);

    expect(listChecks(db, { monitorId })).toHaveLength(1);
    expect(listChecks(db)).toHaveLength(2);
  });

  it("borrar el monitor se lleva sus chequeos", () => {
    insert(db, monitorId, true, 0);
    removeMonitor(db, monitorId);
    expect(listChecks(db)).toHaveLength(0);
  });
});
