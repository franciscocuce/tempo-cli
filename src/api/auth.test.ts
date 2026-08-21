import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { createServer } from "./server.js";
import { countUsers, getUserByEmail } from "../store/users.js";
import { verifyPassword } from "../auth/password.js";
import { CSRF_COOKIE, SESSION_COOKIE } from "./cookies.js";
import {
  ApiClient,
  readCookie,
  signedIn,
  TEST_EMAIL,
  TEST_PASSWORD,
} from "../testing/api-client.js";

const SETUP_TOKEN = "token-de-alta-para-los-tests";

describe("autenticación", () => {
  let db: Database;
  let app: ReturnType<typeof createServer>;

  beforeEach(() => {
    process.env.TEMPO_SECRET_KEY = "clave-de-prueba";
    db = openDb(":memory:");
    app = createServer(db, { setupToken: SETUP_TOKEN, rateLimit: false });
  });

  afterEach(() => {
    delete process.env.TEMPO_SECRET_KEY;
  });

  describe("primer arranque", () => {
    it("GET /api/auth/me avisa que hay que crear el primer usuario", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.setupNeeded).toBe(true);
    });

    it("entrega una cookie csrf en el primer GET", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(readCookie(res, CSRF_COOKIE)).not.toBe("");
    });

    it("crea el primer usuario con el token correcto", async () => {
      const client = new ApiClient(app);
      const res = await client.setup(SETUP_TOKEN);

      expect(res.status).toBe(201);
      expect(res.body.email).toBe(TEST_EMAIL);
      expect(countUsers(db)).toBe(1);
    });

    it("guarda la contraseña hasheada, nunca en claro", async () => {
      const client = new ApiClient(app);
      await client.setup(SETUP_TOKEN);

      const user = getUserByEmail(db, TEST_EMAIL)!;
      expect(user.passwordHash).not.toContain(TEST_PASSWORD);
      expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
      expect(await verifyPassword(user.passwordHash, TEST_PASSWORD)).toBe(true);
    });

    it("rechaza un token de alta que no coincide", async () => {
      const client = new ApiClient(app);
      const res = await client.setup("token-equivocado");

      expect(res.status).toBe(403);
      expect(countUsers(db)).toBe(0);
    });

    it("rechaza una contraseña corta", async () => {
      const client = new ApiClient(app);
      const res = await client.setup(SETUP_TOKEN, TEST_EMAIL, "corta");

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/al menos 10/);
    });

    it("el token de alta sirve una sola vez", async () => {
      const client = new ApiClient(app);
      await client.setup(SETUP_TOKEN);

      const otro = new ApiClient(app);
      const res = await otro.setup(SETUP_TOKEN, "otro@example.com");
      expect(res.status).toBe(409);
      expect(countUsers(db)).toBe(1);
    });

    it("sin token configurado no se puede dar de alta a nadie", async () => {
      const cerrado = createServer(db, { setupToken: null, rateLimit: false });
      const client = new ApiClient(cerrado);
      const res = await client.setup("cualquier-cosa");
      expect(res.status).toBe(409);
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await signedIn(app, SETUP_TOKEN);
    });

    it("entra con las credenciales correctas", async () => {
      const client = new ApiClient(app);
      const res = await client.login();

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(TEST_EMAIL);
      expect(readCookie(res, SESSION_COOKIE)).not.toBe("");
    });

    it("la cookie de sesión es httpOnly y SameSite=Lax", async () => {
      const client = new ApiClient(app);
      const res = await client.login();
      const cookies = (res.headers["set-cookie"] as unknown as string[]).join(" ");

      expect(cookies).toMatch(/tempo_session=[^;]+;.*HttpOnly/i);
      expect(cookies).toMatch(/SameSite=Lax/i);
    });

    it("la cookie csrf NO es httpOnly, porque el front tiene que leerla", async () => {
      const res = await request(app).get("/api/auth/me");
      const csrf = (res.headers["set-cookie"] as unknown as string[]).find((c) =>
        c.startsWith(CSRF_COOKIE)
      )!;
      expect(csrf.toLowerCase()).not.toContain("httponly");
    });

    it("rechaza la contraseña incorrecta", async () => {
      const client = new ApiClient(app);
      const res = await client.login(TEST_EMAIL, "contrasena-equivocada");
      expect(res.status).toBe(401);
    });

    it("da el mismo error si el email no existe, para no delatar quién está registrado", async () => {
      const client = new ApiClient(app);
      const inexistente = await client.login("nadie@example.com", TEST_PASSWORD);
      const malaClave = await client.login(TEST_EMAIL, "otra-cosa-larga");

      expect(inexistente.status).toBe(401);
      expect(inexistente.body.error).toBe(malaClave.body.error);
    });

    it("nunca devuelve el hash de la contraseña", async () => {
      const client = new ApiClient(app);
      const res = await client.login();
      expect(JSON.stringify(res.body)).not.toContain("argon2");
      expect(res.body.passwordHash).toBeUndefined();
    });

    it("el logout invalida la sesión", async () => {
      const client = new ApiClient(app);
      await client.login();
      expect((await client.get("/api/auth/me")).status).toBe(200);

      await client.post("/api/auth/logout");
      expect((await client.get("/api/auth/me")).status).toBe(401);
    });

    it("una sesión vencida no sirve", async () => {
      const client = new ApiClient(app);
      await client.login();

      db.prepare("UPDATE sessions SET expires_at = ?").run("2020-01-01T00:00:00.000Z");
      expect((await client.get("/api/auth/me")).status).toBe(401);
    });

    it("en la base va el hash del token, no el token de la cookie", async () => {
      const client = new ApiClient(app);
      const res = await client.login();
      const token = readCookie(res, SESSION_COOKIE);

      const row = db.prepare("SELECT id FROM sessions").get() as { id: string };
      expect(row.id).not.toBe(token);
      expect(row.id).toHaveLength(64);
    });
  });

  describe("rutas protegidas", () => {
    it("sin sesión, la API devuelve 401", async () => {
      for (const url of ["/api/monitors", "/api/incidents", "/api/channels", "/api/overview"]) {
        expect((await request(app).get(url)).status).toBe(401);
      }
    });

    it("sin sesión no se puede crear un monitor", async () => {
      const res = await request(app)
        .post("/api/monitors")
        .send({ name: "x", url: "https://example.com", cron: "* * * * *" });
      expect(res.status).toBe(401);
    });

    it("con sesión pero sin token csrf responde 403", async () => {
      const client = await signedIn(app, SETUP_TOKEN);
      const res = await client.postWithoutCsrf("/api/monitors", {
        name: "x",
        url: "https://example.com",
        cron: "* * * * *",
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/CSRF/);
    });

    it("con un token csrf que no coincide responde 403", async () => {
      const client = await signedIn(app, SETUP_TOKEN);
      const res = await client.postWithCsrf("/api/monitors", "token-inventado", {
        name: "x",
        url: "https://example.com",
        cron: "* * * * *",
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/CSRF/);
    });

    it("el status público sí se ve sin sesión", async () => {
      const res = await request(app).get("/api/public/status");
      expect(res.status).toBe(200);
      expect(res.body.monitors).toEqual([]);
    });

    it("los eventos SSE piden sesión", async () => {
      expect((await request(app).get("/api/events")).status).toBe(401);
    });
  });

  describe("cambio de contraseña", () => {
    it("cambia la contraseña y cierra las otras sesiones", async () => {
      const client = await signedIn(app, SETUP_TOKEN);
      const otraPestana = new ApiClient(app);
      await otraPestana.login();

      const res = await client.post("/api/auth/password", {
        current: TEST_PASSWORD,
        next: "contrasena-nueva-2",
      });

      expect(res.status).toBe(200);
      expect((await otraPestana.get("/api/auth/me")).status).toBe(401);
      expect((await client.get("/api/auth/me")).status).toBe(200);
    });

    it("no cambia nada si la contraseña actual no coincide", async () => {
      const client = await signedIn(app, SETUP_TOKEN);
      const res = await client.post("/api/auth/password", {
        current: "no-es-esta",
        next: "contrasena-nueva-2",
      });

      expect(res.status).toBe(403);
      const user = getUserByEmail(db, TEST_EMAIL)!;
      expect(await verifyPassword(user.passwordHash, TEST_PASSWORD)).toBe(true);
    });
  });

  describe("hardening", () => {
    it("manda las cabeceras de helmet", async () => {
      const res = await request(app).get("/api/public/status");
      expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
      expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("rechaza un body gigante", async () => {
      const client = await signedIn(app, SETUP_TOKEN);
      const res = await client.post("/api/monitors", {
        name: "x".repeat(64 * 1024),
        url: "https://example.com",
        cron: "* * * * *",
      });

      expect(res.status).toBe(413);
    });

    it("corta después de varios intentos fallidos de login", async () => {
      const limitada = createServer(db, { setupToken: SETUP_TOKEN, rateLimit: true });
      await signedIn(limitada, SETUP_TOKEN);

      const client = new ApiClient(limitada);
      await client.handshake();

      const codes: number[] = [];
      for (let i = 0; i < 7; i++) {
        codes.push((await client.login(TEST_EMAIL, "clave-equivocada")).status);
      }

      expect(codes.filter((code) => code === 401).length).toBe(5);
      expect(codes.at(-1)).toBe(429);
    });
  });
});
