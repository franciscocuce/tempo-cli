import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express, { type Express } from "express";
import type { Database } from "better-sqlite3";
import { createApiRouter } from "./routes.js";

// dos niveles arriba es la raíz del proyecto, tanto desde src/api/ como desde dist/api/
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIST = path.resolve(MODULE_DIR, "..", "..", "dashboard", "dist");

export function createServer(db: Database): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter(db));

  if (existsSync(DASHBOARD_DIST)) {
    app.use(express.static(DASHBOARD_DIST));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(DASHBOARD_DIST, "index.html"));
    });
  }

  return app;
}
