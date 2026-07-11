import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import {
  addTask,
  listTasks,
  getTask,
  removeTask,
  setTaskEnabled,
} from "./tasks.js";

const sampleTask = {
  name: "backup",
  cron: "*/5 * * * *",
  type: "shell" as const,
  payload: "echo hola",
};

describe("store de tareas", () => {
  let db: Database;

  beforeEach(() => {
    db = openDb(":memory:");
  });

  it("agrega una tarea y la devuelve completa", () => {
    const task = addTask(db, sampleTask);
    expect(task.id).toBe(1);
    expect(task.name).toBe("backup");
    expect(task.enabled).toBe(true);
    expect(task.createdAt).toBeTruthy();
  });

  it("rechaza nombres duplicados", () => {
    addTask(db, sampleTask);
    expect(() => addTask(db, sampleTask)).toThrowError(/UNIQUE/);
  });

  it("lista las tareas ordenadas por id", () => {
    addTask(db, sampleTask);
    addTask(db, { ...sampleTask, name: "ping", type: "http", payload: "https://example.com" });
    const tasks = listTasks(db);
    expect(tasks.map((t) => t.name)).toEqual(["backup", "ping"]);
  });

  it("devuelve undefined si el id no existe", () => {
    expect(getTask(db, 99)).toBeUndefined();
  });

  it("elimina una tarea existente", () => {
    const task = addTask(db, sampleTask);
    expect(removeTask(db, task.id)).toBe(true);
    expect(listTasks(db)).toHaveLength(0);
  });

  it("devuelve false al eliminar un id inexistente", () => {
    expect(removeTask(db, 99)).toBe(false);
  });

  it("pausa y reactiva una tarea", () => {
    const task = addTask(db, sampleTask);
    expect(setTaskEnabled(db, task.id, false)).toBe(true);
    expect(getTask(db, task.id)?.enabled).toBe(false);
    expect(setTaskEnabled(db, task.id, true)).toBe(true);
    expect(getTask(db, task.id)?.enabled).toBe(true);
  });

  it("devuelve false al pausar un id inexistente", () => {
    expect(setTaskEnabled(db, 99, false)).toBe(false);
  });
});
