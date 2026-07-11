import { describe, it, expect } from "vitest";
import { newTaskSchema } from "./validate.js";

const validShell = {
  name: "backup",
  cron: "*/5 * * * *",
  type: "shell",
  payload: "echo hola",
};

const validHttp = {
  name: "ping",
  cron: "0 9 * * 1",
  type: "http",
  payload: "https://example.com",
};

describe("newTaskSchema", () => {
  it("acepta una tarea shell válida", () => {
    expect(newTaskSchema.safeParse(validShell).success).toBe(true);
  });

  it("acepta una tarea http válida", () => {
    expect(newTaskSchema.safeParse(validHttp).success).toBe(true);
  });

  it("rechaza un nombre vacío", () => {
    const result = newTaskSchema.safeParse({ ...validShell, name: "  " });
    expect(result.success).toBe(false);
  });

  it("rechaza una expresión cron inválida", () => {
    const result = newTaskSchema.safeParse({ ...validShell, cron: "99 * * * *" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("fuera de rango");
    }
  });

  it("rechaza un tipo desconocido", () => {
    const result = newTaskSchema.safeParse({ ...validShell, type: "ftp" });
    expect(result.success).toBe(false);
  });

  it("rechaza un payload vacío", () => {
    const result = newTaskSchema.safeParse({ ...validShell, payload: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza una URL inválida cuando el tipo es http", () => {
    const result = newTaskSchema.safeParse({ ...validHttp, payload: "no-es-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("URL");
    }
  });

  it("acepta cualquier texto como payload cuando el tipo es shell", () => {
    const result = newTaskSchema.safeParse({ ...validShell, payload: "dir /b" });
    expect(result.success).toBe(true);
  });
});
