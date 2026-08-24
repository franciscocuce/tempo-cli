import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { dueMonitors, createLimiter } from "./loop.js";
import { acquireLock, lockHolder } from "./lock.js";
import type { Monitor } from "../store/monitors.js";

function monitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    id: 1,
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
    enabled: true,
    isPublic: true,
    certExpiresAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("dueMonitors", () => {
  it("'* * * * *' entra siempre", () => {
    expect(dueMonitors([monitor()], new Date(2026, 0, 1, 10, 30))).toHaveLength(1);
  });

  it("no dispara fuera de hora", () => {
    const cada5 = monitor({ cron: "*/5 * * * *" });
    expect(dueMonitors([cada5], new Date(2026, 0, 1, 10, 3))).toHaveLength(0);
    expect(dueMonitors([cada5], new Date(2026, 0, 1, 10, 5))).toHaveLength(1);
  });

  it("saltea los pausados", () => {
    expect(dueMonitors([monitor({ enabled: false })], new Date(2026, 0, 1, 10, 30))).toHaveLength(
      0,
    );
  });

  it("un cron roto no tumba al resto", () => {
    const monitors = [monitor({ id: 1, cron: "esto no es cron" }), monitor({ id: 2 })];
    expect(dueMonitors(monitors, new Date(2026, 0, 1, 10, 30)).map((m) => m.id)).toEqual([2]);
  });
});

describe("createLimiter", () => {
  it("no deja pasar más de N a la vez", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;

    const task = () =>
      limit(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
      });

    await Promise.all([task(), task(), task(), task(), task()]);
    expect(peak).toBe(2);
  });

  it("libera el turno aunque la tarea falle", async () => {
    const limit = createLimiter(1);

    await expect(limit(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(limit(() => Promise.resolve("sigo andando"))).resolves.toBe("sigo andando");
  });
});

describe("lock de instancia única", () => {
  let db: Database;

  beforeEach(() => {
    db = openDb(":memory:");
  });

  it("el primero se lo queda", () => {
    const lock = acquireLock(db);
    expect(lock).not.toBeNull();
    expect(lockHolder(db)?.pid).toBe(process.pid);
    lock?.release();
  });

  it("al soltarlo queda libre", () => {
    acquireLock(db)?.release();
    expect(lockHolder(db)).toBeNull();
  });

  it("no se lo puede llevar otro proceso vivo", () => {
    const now = new Date();
    db.prepare(
      "INSERT INTO scheduler_lock (id, pid, host, heartbeat_at) VALUES (1, 99999, 'otra-maquina', ?)",
    ).run(now.toISOString());

    expect(acquireLock(db, now)).toBeNull();
  });

  it("un lock abandonado se puede tomar", () => {
    const now = new Date();
    const viejo = new Date(now.getTime() - 10 * 60_000);
    db.prepare(
      "INSERT INTO scheduler_lock (id, pid, host, heartbeat_at) VALUES (1, 99999, 'otra-maquina', ?)",
    ).run(viejo.toISOString());

    const lock = acquireLock(db, now);
    expect(lock).not.toBeNull();
    expect(lockHolder(db)?.pid).toBe(process.pid);
    lock?.release();
  });
});
