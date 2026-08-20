import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import {
  addMonitor,
  listMonitors,
  listPublicMonitors,
  getMonitor,
  updateMonitor,
  removeMonitor,
  setMonitorEnabled,
  setCertExpiry,
  type NewMonitor,
} from "./monitors.js";

const sample: NewMonitor = {
  name: "portfolio",
  url: "https://franciscocuce.dev",
  method: "GET",
  cron: "*/5 * * * *",
  expectedStatus: "2xx",
  keyword: null,
  keywordMode: "contains",
  timeoutMs: 10_000,
  followRedirects: true,
  confirmThreshold: 2,
  isPublic: true,
};

describe("store de monitores", () => {
  let db: Database;

  beforeEach(() => {
    db = openDb(":memory:");
  });

  it("agrega un monitor y lo devuelve completo", () => {
    const monitor = addMonitor(db, sample);
    expect(monitor.id).toBe(1);
    expect(monitor.name).toBe("portfolio");
    expect(monitor.enabled).toBe(true);
    expect(monitor.isPublic).toBe(true);
    expect(monitor.certExpiresAt).toBeNull();
    expect(monitor.createdAt).toBeTruthy();
  });

  it("guarda los booleanos como 0/1 y los devuelve como boolean", () => {
    const monitor = addMonitor(db, { ...sample, followRedirects: false, isPublic: false });
    expect(monitor.followRedirects).toBe(false);
    expect(getMonitor(db, monitor.id)?.isPublic).toBe(false);
  });

  it("rechaza nombres duplicados", () => {
    addMonitor(db, sample);
    expect(() => addMonitor(db, sample)).toThrowError(/UNIQUE/);
  });

  it("lista ordenado por id", () => {
    addMonitor(db, sample);
    addMonitor(db, { ...sample, name: "blog", url: "https://blog.example" });
    expect(listMonitors(db).map((m) => m.name)).toEqual(["portfolio", "blog"]);
  });

  it("filtra los públicos", () => {
    addMonitor(db, sample);
    addMonitor(db, { ...sample, name: "interno", isPublic: false });
    expect(listPublicMonitors(db).map((m) => m.name)).toEqual(["portfolio"]);
  });

  it("devuelve undefined si el id no existe", () => {
    expect(getMonitor(db, 99)).toBeUndefined();
  });

  it("actualiza solo los campos que le pasan", () => {
    const monitor = addMonitor(db, sample);
    const updated = updateMonitor(db, monitor.id, { cron: "* * * * *", keyword: "Francisco" });

    expect(updated?.cron).toBe("* * * * *");
    expect(updated?.keyword).toBe("Francisco");
    expect(updated?.url).toBe(sample.url);
    expect(updated?.timeoutMs).toBe(sample.timeoutMs);
  });

  it("un patch vacío no rompe nada", () => {
    const monitor = addMonitor(db, sample);
    expect(updateMonitor(db, monitor.id, {})?.name).toBe("portfolio");
  });

  it("devuelve undefined al actualizar un id inexistente", () => {
    expect(updateMonitor(db, 99, { cron: "* * * * *" })).toBeUndefined();
  });

  it("pausa y reactiva", () => {
    const monitor = addMonitor(db, sample);
    expect(setMonitorEnabled(db, monitor.id, false)).toBe(true);
    expect(getMonitor(db, monitor.id)?.enabled).toBe(false);
    expect(setMonitorEnabled(db, monitor.id, true)).toBe(true);
    expect(getMonitor(db, monitor.id)?.enabled).toBe(true);
  });

  it("guarda el vencimiento del certificado", () => {
    const monitor = addMonitor(db, sample);
    setCertExpiry(db, monitor.id, "2026-12-01T00:00:00.000Z");
    expect(getMonitor(db, monitor.id)?.certExpiresAt).toBe("2026-12-01T00:00:00.000Z");
  });

  it("elimina un monitor", () => {
    const monitor = addMonitor(db, sample);
    expect(removeMonitor(db, monitor.id)).toBe(true);
    expect(listMonitors(db)).toHaveLength(0);
  });

  it("devuelve false al eliminar un id inexistente", () => {
    expect(removeMonitor(db, 99)).toBe(false);
  });
});
