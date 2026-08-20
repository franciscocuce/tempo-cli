import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { addMonitor, type NewMonitor } from "../store/monitors.js";
import { addCheck } from "../store/checks.js";
import { createServer } from "./server.js";

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

const validBody = {
  name: "blog",
  url: "https://blog.example.com",
  cron: "* * * * *",
  keyword: null,
};

describe("API REST", () => {
  let db: Database;
  let app: ReturnType<typeof createServer>;

  beforeEach(() => {
    process.env.TEMPO_SECRET_KEY = "clave-de-prueba";
    process.env.TEMPO_ALLOW_PRIVATE_TARGETS = "1";
    db = openDb(":memory:");
    app = createServer(db);
  });

  afterEach(() => {
    delete process.env.TEMPO_SECRET_KEY;
    delete process.env.TEMPO_ALLOW_PRIVATE_TARGETS;
    vi.unstubAllGlobals();
  });

  describe("monitores", () => {
    it("GET /api/monitors devuelve el estado y el próximo chequeo", async () => {
      addMonitor(db, sample);
      const res = await request(app).get("/api/monitors");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("portfolio");
      expect(res.body[0].status).toBe("pending");
      expect(typeof res.body[0].nextRun).toBe("string");
    });

    it("un monitor pausado tiene nextRun null y estado paused", async () => {
      const monitor = addMonitor(db, sample);
      await request(app).patch(`/api/monitors/${monitor.id}`).send({ enabled: false });

      const res = await request(app).get("/api/monitors");
      expect(res.body[0].nextRun).toBeNull();
      expect(res.body[0].status).toBe("paused");
    });

    it("refleja el último chequeo", async () => {
      const monitor = addMonitor(db, sample);
      addCheck(db, {
        monitorId: monitor.id,
        checkedAt: new Date().toISOString(),
        ok: true,
        httpStatus: 200,
        latencyMs: 231,
        error: null,
      });

      const res = await request(app).get("/api/monitors");
      expect(res.body[0].status).toBe("up");
      expect(res.body[0].lastLatencyMs).toBe(231);
      expect(res.body[0].uptime24h).toBe(100);
    });

    it("POST /api/monitors crea uno válido con los defaults", async () => {
      const res = await request(app).post("/api/monitors").send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeGreaterThan(0);
      expect(res.body.method).toBe("GET");
      expect(res.body.expectedStatus).toBe("2xx");
      expect(res.body.confirmThreshold).toBe(2);
    });

    it("rechaza un cron inválido con 400", async () => {
      const res = await request(app)
        .post("/api/monitors")
        .send({ ...validBody, cron: "99 * * * *" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it("rechaza una URL que no es http con 400", async () => {
      const res = await request(app)
        .post("/api/monitors")
        .send({ ...validBody, url: "file:///etc/passwd" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/http y https/);
    });

    it("rechaza nombre repetido con 409", async () => {
      await request(app).post("/api/monitors").send(validBody);
      const res = await request(app).post("/api/monitors").send(validBody);
      expect(res.status).toBe(409);
    });

    it("PATCH cambia solo lo que le mandan", async () => {
      const monitor = addMonitor(db, sample);
      const res = await request(app)
        .patch(`/api/monitors/${monitor.id}`)
        .send({ cron: "* * * * *" });

      expect(res.body.cron).toBe("* * * * *");
      expect(res.body.url).toBe(sample.url);
    });

    it("PATCH a un id inexistente responde 404", async () => {
      const res = await request(app).patch("/api/monitors/999").send({ enabled: false });
      expect(res.status).toBe(404);
    });

    it("PATCH con datos inválidos responde 400", async () => {
      const monitor = addMonitor(db, sample);
      const res = await request(app)
        .patch(`/api/monitors/${monitor.id}`)
        .send({ cron: "no es cron" });
      expect(res.status).toBe(400);
    });

    it("DELETE borra el monitor", async () => {
      const monitor = addMonitor(db, sample);
      expect((await request(app).delete(`/api/monitors/${monitor.id}`)).status).toBe(204);
      expect((await request(app).get("/api/monitors")).body).toHaveLength(0);
    });

    it("DELETE a un id inexistente responde 404", async () => {
      expect((await request(app).delete("/api/monitors/999")).status).toBe(404);
    });

    it("id inválido responde 400", async () => {
      expect((await request(app).get("/api/monitors/abc")).status).toBe(400);
    });
  });

  describe("chequeo manual", () => {
    it("POST /api/monitors/:id/check chequea y guarda el resultado", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
      const monitor = addMonitor(db, sample);

      const res = await request(app).post(`/api/monitors/${monitor.id}/check`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.httpStatus).toBe(200);

      const checks = await request(app).get(`/api/monitors/${monitor.id}/checks`);
      expect(checks.body).toHaveLength(1);
      expect(checks.body[0].monitorName).toBe("portfolio");
    });

    it("un fallo confirmado abre incidente", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
      const monitor = addMonitor(db, { ...sample, confirmThreshold: 1 });

      const res = await request(app).post(`/api/monitors/${monitor.id}/check`);
      expect(res.body.ok).toBe(false);
      expect(res.body.opened).toBe(true);

      const incidents = await request(app).get("/api/incidents");
      expect(incidents.body).toHaveLength(1);
      expect(incidents.body[0].monitorName).toBe("portfolio");
      expect(incidents.body[0].resolvedAt).toBeNull();
    });
  });

  describe("listados", () => {
    it("el limit se recorta y no se puede pedir la tabla entera", async () => {
      const monitor = addMonitor(db, sample);
      for (let i = 0; i < 5; i++) {
        addCheck(db, {
          monitorId: monitor.id,
          checkedAt: new Date(Date.now() - i * 60_000).toISOString(),
          ok: true,
          httpStatus: 200,
          latencyMs: 100,
          error: null,
        });
      }

      const res = await request(app).get("/api/checks?limit=999999999");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5);
    });

    it("GET /api/overview resume el estado general", async () => {
      addMonitor(db, sample);
      addMonitor(db, { ...sample, name: "blog" });

      const res = await request(app).get("/api/overview");
      expect(res.body.total).toBe(2);
      expect(res.body.active).toBe(2);
      expect(res.body.openIncidents).toBe(0);
    });

    it("GET /api/monitors/:id/stats trae el historial de 90 días", async () => {
      const monitor = addMonitor(db, sample);
      const res = await request(app).get(`/api/monitors/${monitor.id}/stats`);

      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(90);
      expect(res.body.uptime24h.percent).toBeNull();
    });

    it("stats de un monitor inexistente responde 404", async () => {
      expect((await request(app).get("/api/monitors/999/stats")).status).toBe(404);
    });
  });

  describe("canales", () => {
    const webhook = "https://discord.com/api/webhooks/123/tokenSecreto";

    it("POST /api/channels nunca devuelve el webhook completo", async () => {
      const res = await request(app)
        .post("/api/channels")
        .send({ type: "discord", label: "mi server", target: webhook });

      expect(res.status).toBe(201);
      expect(res.body.target).not.toContain("tokenSecreto");
      expect(res.body.target).toContain("••••");
    });

    it("GET /api/channels tampoco lo devuelve", async () => {
      await request(app)
        .post("/api/channels")
        .send({ type: "discord", label: "mi server", target: webhook });

      const res = await request(app).get("/api/channels");
      expect(JSON.stringify(res.body)).not.toContain("tokenSecreto");
    });

    it("rechaza un canal sin URL válida", async () => {
      const res = await request(app)
        .post("/api/channels")
        .send({ type: "discord", label: "x", target: "pepe" });
      expect(res.status).toBe(400);
    });

    it("POST /api/channels/:id/test avisa si el webhook falla", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 401 })));
      const created = await request(app)
        .post("/api/channels")
        .send({ type: "discord", label: "mi server", target: webhook });

      const res = await request(app).post(`/api/channels/${created.body.id}/test`);
      expect(res.status).toBe(502);
      expect(res.body.error).toContain("401");
    });
  });

  describe("status público", () => {
    it("solo muestra los monitores marcados como públicos", async () => {
      addMonitor(db, sample);
      addMonitor(db, { ...sample, name: "interno", isPublic: false });

      const res = await request(app).get("/api/public/status");
      expect(res.status).toBe(200);
      expect(res.body.monitors).toHaveLength(1);
      expect(res.body.monitors[0].name).toBe("portfolio");
    });

    it("manda el historial compacto, un valor por día", async () => {
      addMonitor(db, sample);
      const res = await request(app).get("/api/public/status");

      expect(res.body.days).toBe(90);
      expect(res.body.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.body.monitors[0].days).toHaveLength(90);
      expect(res.body.monitors[0].days.every((d: unknown) => d === null)).toBe(true);
    });

    it("no filtra la URL ni la configuración interna", async () => {
      addMonitor(db, sample);
      const res = await request(app).get("/api/public/status");
      const body = JSON.stringify(res.body);

      expect(body).not.toContain("franciscocuce.dev");
      expect(body).not.toContain("confirmThreshold");
    });
  });
});
