import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { addTask } from "../store/tasks.js";
import { createServer } from "./server.js";

describe("API REST", () => {
  let db: Database;
  let app: ReturnType<typeof createServer>;

  beforeEach(() => {
    db = openDb(":memory:");
    app = createServer(db);
  });

  it("GET /api/tasks devuelve las tareas con su próximo disparo", async () => {
    addTask(db, { name: "backup", cron: "*/5 * * * *", type: "shell", payload: "echo hola" });
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("backup");
    expect(typeof res.body[0].nextRun).toBe("string");
  });

  it("una tarea pausada tiene nextRun null", async () => {
    const task = addTask(db, {
      name: "ping",
      cron: "* * * * *",
      type: "http",
      payload: "https://example.com",
    });
    await request(app).patch(`/api/tasks/${task.id}`).send({ enabled: false });
    const res = await request(app).get("/api/tasks");
    expect(res.body[0].nextRun).toBeNull();
  });

  it("POST /api/tasks crea una tarea válida", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ name: "eco", cron: "* * * * *", type: "shell", command: "echo tick" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeGreaterThan(0);
    expect(res.body.payload).toBe("echo tick");
  });

  it("POST /api/tasks rechaza un cron inválido con 400", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ name: "malo", cron: "99 * * * *", type: "shell", command: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("POST /api/tasks rechaza nombre repetido con 409", async () => {
    const body = { name: "dup", cron: "* * * * *", type: "shell", command: "x" };
    await request(app).post("/api/tasks").send(body);
    const res = await request(app).post("/api/tasks").send(body);
    expect(res.status).toBe(409);
  });

  it("PATCH /api/tasks/:id pausa y reactiva", async () => {
    const task = addTask(db, { name: "t", cron: "* * * * *", type: "shell", payload: "x" });
    const off = await request(app).patch(`/api/tasks/${task.id}`).send({ enabled: false });
    expect(off.body.enabled).toBe(false);
    const on = await request(app).patch(`/api/tasks/${task.id}`).send({ enabled: true });
    expect(on.body.enabled).toBe(true);
  });

  it("PATCH a un id inexistente responde 404", async () => {
    const res = await request(app).patch("/api/tasks/999").send({ enabled: false });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/tasks/:id borra la tarea", async () => {
    const task = addTask(db, { name: "borrame", cron: "* * * * *", type: "shell", payload: "x" });
    const del = await request(app).delete(`/api/tasks/${task.id}`);
    expect(del.status).toBe(204);
    const list = await request(app).get("/api/tasks");
    expect(list.body).toHaveLength(0);
  });

  it("DELETE a un id inexistente responde 404", async () => {
    const res = await request(app).delete("/api/tasks/999");
    expect(res.status).toBe(404);
  });

  it("POST /api/tasks/:id/run ejecuta y queda en el historial", async () => {
    const task = addTask(db, {
      name: "correme",
      cron: "* * * * *",
      type: "shell",
      payload: 'node -e "console.log(1)"',
    });
    const res = await request(app).post(`/api/tasks/${task.id}/run`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");

    const runs = await request(app).get("/api/runs");
    expect(runs.body).toHaveLength(1);
    expect(runs.body[0].taskName).toBe("correme");
  });
});
