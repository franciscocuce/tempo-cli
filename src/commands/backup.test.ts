import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { backup, restore } from "./backup.js";
import { openDb, defaultDbPath } from "../db/connection.js";
import { addMonitor, listMonitors } from "../store/monitors.js";

const sample = {
  name: "portfolio",
  url: "https://franciscocuce.dev",
  method: "GET" as const,
  cron: "*/5 * * * *",
  expectedStatus: "2xx",
  keyword: null,
  keywordMode: "contains" as const,
  timeoutMs: 10_000,
  followRedirects: true,
  confirmThreshold: 2,
  isPublic: true,
};

let dir: string;
let previousDataDir: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tempo-backup-"));
  previousDataDir = process.env.TEMPO_DATA_DIR;
  process.env.TEMPO_DATA_DIR = dir;

  // los comandos hablan por consola; en los tests solo estorba
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  // los comandos marcan el fallo con process.exitCode, que es del proceso entero:
  // sin esto, un test de camino triste haría fallar toda la corrida
  process.exitCode = 0;

  if (previousDataDir === undefined) {
    delete process.env.TEMPO_DATA_DIR;
  } else {
    process.env.TEMPO_DATA_DIR = previousDataDir;
  }
  rmSync(dir, { recursive: true, force: true });
});

function seed(): void {
  const db = openDb();
  addMonitor(db, sample);
  db.close();
}

describe("backup", () => {
  it("deja una copia que se puede abrir y tiene los datos", async () => {
    seed();
    const dest = path.join(dir, "copia.db");

    await backup(dest);

    expect(existsSync(dest)).toBe(true);
    const copy = new Database(dest, { readonly: true });
    const rows = copy.prepare("SELECT name FROM monitors").all() as { name: string }[];
    copy.close();

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("portfolio");
    expect(process.exitCode).not.toBe(1);
  });

  it("copia lo que todavía vive en el WAL", async () => {
    // el punto de usar .backup() y no `cp`: con WAL, lo recién escrito puede no estar
    // todavía en el .db, y una copia del archivo suelto se lo perdería
    const db = openDb();
    addMonitor(db, { ...sample, name: "recien-escrito" });

    const dest = path.join(dir, "caliente.db");
    await db.backup(dest);
    db.close();

    const copy = new Database(dest, { readonly: true });
    const rows = copy.prepare("SELECT name FROM monitors").all() as { name: string }[];
    copy.close();

    expect(rows.map((r) => r.name)).toContain("recien-escrito");
  });

  it("si el destino es una carpeta, arma el nombre con la fecha", async () => {
    seed();
    const outDir = path.join(dir, "copias");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(outDir);

    await backup(outDir);

    const files = readdirSync(outDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^tempo-\d{4}-\d{2}-\d{2}T[\d-]+\.db$/);
  });
});

describe("restore", () => {
  it("reemplaza la base y deja la anterior en .bak", async () => {
    seed();
    const copy = path.join(dir, "copia.db");
    await backup(copy);

    // ahora la base viva cambia: se agrega otro monitor
    const db = openDb();
    addMonitor(db, { ...sample, name: "agregado-despues" });
    db.close();

    await restore(copy, { yes: true });

    const after = openDb();
    const names = listMonitors(after).map((m) => m.name);
    after.close();

    expect(names).toEqual(["portfolio"]);
    expect(names).not.toContain("agregado-despues");
    expect(existsSync(`${defaultDbPath()}.bak`)).toBe(true);
  });

  it("no restaura un archivo que no existe", async () => {
    await restore(path.join(dir, "fantasma.db"), { yes: true });
    expect(process.exitCode).toBe(1);
  });

  it("no restaura un archivo que no es una base de datos", async () => {
    const fake = path.join(dir, "cualquiera.txt");
    writeFileSync(fake, "esto no es sqlite");

    await restore(fake, { yes: true });

    expect(process.exitCode).toBe(1);
  });

  it("rechaza una copia de un esquema más nuevo que este binario", async () => {
    seed();
    const copy = path.join(dir, "delfuturo.db");
    await backup(copy);

    const future = new Database(copy);
    future.pragma("user_version = 99");
    future.close();

    await restore(copy, { yes: true });

    expect(process.exitCode).toBe(1);
    expect(existsSync(`${defaultDbPath()}.bak`)).toBe(false);
  });

  it("no pisa nada si hay un scheduler latiendo sobre la base", async () => {
    seed();
    const copy = path.join(dir, "copia.db");
    await backup(copy);

    const db = openDb();
    db.prepare(
      `INSERT INTO scheduler_lock (id, pid, host, heartbeat_at)
       VALUES (1, ?, ?, ?)`,
    ).run(999999, "otra-maquina", new Date().toISOString());
    db.close();

    await restore(copy, { yes: true });

    expect(process.exitCode).toBe(1);
    expect(existsSync(`${defaultDbPath()}.bak`)).toBe(false);
  });

  it("deja restaurar si el lock quedó viejo de un proceso muerto", async () => {
    seed();
    const copy = path.join(dir, "copia.db");
    await backup(copy);

    const db = openDb();
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare(
      `INSERT INTO scheduler_lock (id, pid, host, heartbeat_at)
       VALUES (1, ?, ?, ?)`,
    ).run(999999, "otra-maquina", old);
    db.close();

    await restore(copy, { yes: true });

    expect(process.exitCode).not.toBe(1);
    expect(existsSync(`${defaultDbPath()}.bak`)).toBe(true);
  });
});
