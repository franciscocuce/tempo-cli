import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { migrate, currentVersion } from "./index.js";

function rawDb(): Database.Database {
  return new Database(":memory:");
}

function tableNames(db: Database.Database): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

describe("migraciones", () => {
  it("una base nueva arranca en la versión 0", () => {
    expect(currentVersion(rawDb())).toBe(0);
  });

  it("aplica todas las migraciones y deja la versión al día", () => {
    const db = rawDb();
    const version = migrate(db);
    expect(version).toBeGreaterThan(0);
    expect(currentVersion(db)).toBe(version);
  });

  it("no vuelve a aplicar lo ya aplicado", () => {
    const db = rawDb();
    const first = migrate(db);
    const second = migrate(db);
    expect(second).toBe(first);
  });

  it("deja las tablas del monitor creadas", () => {
    const db = rawDb();
    migrate(db);
    const tables = tableNames(db);
    expect(tables).toEqual(
      expect.arrayContaining(["monitors", "checks", "checks_daily", "incidents", "channels"])
    );
  });

  it("se lleva puestas las tablas viejas de tareas", () => {
    const db = rawDb();
    migrate(db);
    const tables = tableNames(db);
    expect(tables).not.toContain("tasks");
    expect(tables).not.toContain("runs");
  });

  it("migra una base que se quedó en la versión 1", () => {
    const db = rawDb();
    db.exec("CREATE TABLE tasks (id INTEGER PRIMARY KEY, name TEXT)");
    db.pragma("user_version = 1");

    migrate(db);
    expect(tableNames(db)).toContain("monitors");
    expect(tableNames(db)).not.toContain("tasks");
  });
});
