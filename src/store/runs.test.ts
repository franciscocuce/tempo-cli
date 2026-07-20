import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { addTask, removeTask } from "./tasks.js";
import { addRun, listRuns } from "./runs.js";

function sampleRun(taskId: number, overrides: Partial<Parameters<typeof addRun>[1]> = {}) {
  return {
    taskId,
    startedAt: new Date().toISOString(),
    durationMs: 12,
    status: "ok" as const,
    output: "hola",
    ...overrides,
  };
}

describe("store de runs", () => {
  let db: Database;
  let taskId: number;

  beforeEach(() => {
    db = openDb(":memory:");
    taskId = addTask(db, {
      name: "backup",
      cron: "*/5 * * * *",
      type: "shell",
      payload: "echo hola",
    }).id;
  });

  it("registra una ejecución y la lista con el nombre de la tarea", () => {
    addRun(db, sampleRun(taskId));
    const runs = listRuns(db);
    expect(runs).toHaveLength(1);
    expect(runs[0].taskName).toBe("backup");
    expect(runs[0].status).toBe("ok");
  });

  it("lista las más recientes primero", () => {
    addRun(db, sampleRun(taskId, { output: "primera" }));
    addRun(db, sampleRun(taskId, { output: "segunda" }));
    const runs = listRuns(db);
    expect(runs.map((r) => r.output)).toEqual(["segunda", "primera"]);
  });

  it("respeta el límite", () => {
    for (let i = 0; i < 5; i++) {
      addRun(db, sampleRun(taskId));
    }
    expect(listRuns(db, { limit: 3 })).toHaveLength(3);
  });

  it("filtra por tarea", () => {
    const otherId = addTask(db, {
      name: "ping",
      cron: "* * * * *",
      type: "http",
      payload: "https://example.com",
    }).id;
    addRun(db, sampleRun(taskId));
    addRun(db, sampleRun(otherId));

    const runs = listRuns(db, { taskId: otherId });
    expect(runs).toHaveLength(1);
    expect(runs[0].taskName).toBe("ping");
  });

  it("borra el historial al borrar la tarea (cascade)", () => {
    addRun(db, sampleRun(taskId));
    removeTask(db, taskId);
    expect(listRuns(db)).toHaveLength(0);
  });
});
