import { describe, it, expect, vi } from "vitest";
import { dueTasks } from "./loop.js";
import type { Task } from "../store/tasks.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    name: "tarea",
    cron: "* * * * *",
    type: "shell",
    payload: "echo hola",
    enabled: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// lunes 5 de enero de 2026, 09:30 local
const date = new Date(2026, 0, 5, 9, 30);

describe("dueTasks", () => {
  it("incluye la tarea si el cron coincide con la fecha", () => {
    const tasks = [makeTask({ cron: "30 9 * * *" })];
    expect(dueTasks(tasks, date)).toHaveLength(1);
  });

  it("excluye la tarea si el cron no coincide", () => {
    const tasks = [makeTask({ cron: "0 12 * * *" })];
    expect(dueTasks(tasks, date)).toHaveLength(0);
  });

  it("excluye tareas pausadas aunque el cron coincida", () => {
    const tasks = [makeTask({ enabled: false })];
    expect(dueTasks(tasks, date)).toHaveLength(0);
  });

  it("saltea un cron inválido sin romper y sigue con el resto", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const tasks = [
      makeTask({ id: 1, name: "rota", cron: "no es cron" }),
      makeTask({ id: 2, name: "sana", cron: "30 9 * * 1" }),
    ];
    const due = dueTasks(tasks, date);
    expect(due.map((t) => t.name)).toEqual(["sana"]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
