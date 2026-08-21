import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express, { type Express } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import type { Database } from "better-sqlite3";
import { createApiRouter } from "./routes.js";
import { createAuthRouter, type SetupToken } from "./auth.js";
import { createPublicRouter } from "./public.js";
import { createEventsRouter } from "./events.js";
import { attachUser, ensureCsrfCookie, requireAuth, requireCsrf } from "./middleware/auth.js";
import { createEventBus, type EventBus } from "../events/bus.js";

// dos niveles arriba es la raíz del proyecto, tanto desde src/api/ como desde dist/api/
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIST = path.resolve(MODULE_DIR, "..", "..", "dashboard", "dist");

const BODY_LIMIT = "16kb";

export interface ServerOptions {
  setupToken?: string | null;
  bus?: EventBus;
  trustProxy?: boolean | number | string;
  rateLimit?: boolean;
}

export function createServer(db: Database, options: ServerOptions = {}): Express {
  const app = express();
  const setup: SetupToken = { value: options.setupToken ?? null };
  const bus = options.bus ?? createEventBus();

  app.disable("x-powered-by");

  // detrás de un reverse proxy hace falta para que el rate limit vea la IP real y no la del proxy
  if (options.trustProxy !== undefined) {
    app.set("trust proxy", options.trustProxy);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // React escribe estilos en el atributo style, que sin esto la CSP bloquea.
          // scriptSrc, que es la que frena un XSS, queda estricta
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: BODY_LIMIT }));

  const limits = options.rateLimit !== false;

  app.use("/api", ensureCsrfCookie, attachUser(db));

  if (limits) {
    app.use("/api", generalLimiter());
    app.use(["/api/auth/login", "/api/auth/setup"], loginLimiter());
  }

  app.use("/api/public", createPublicRouter(db));
  app.use("/api/auth", requireCsrf, createAuthRouter(db, setup));
  app.use("/api/events", requireAuth, createEventsRouter(bus));
  app.use("/api", requireAuth, requireCsrf, createApiRouter(db, bus));

  if (existsSync(DASHBOARD_DIST)) {
    app.use(express.static(DASHBOARD_DIST));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(DASHBOARD_DIST, "index.html"));
    });
  }

  return app;
}

function generalLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Demasiadas peticiones, esperá un minuto" },
  });
}

function loginLimiter() {
  return rateLimit({
    windowMs: 15 * 60_000,
    limit: 5,
    // solo cuentan los intentos fallidos: entrar bien no gasta el cupo
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Demasiados intentos fallidos. Probá de nuevo en 15 minutos" },
  });
}
