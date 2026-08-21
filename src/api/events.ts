import { Router } from "express";
import type { EventBus } from "../events/bus.js";

// cada 25s va un comentario SSE para que los proxies no corten la conexión por inactividad
const KEEPALIVE_MS = 25_000;

export function createEventsRouter(bus: EventBus): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.flushHeaders();
    res.write(": conectado\n\n");

    const unsubscribe = bus.subscribe((event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const keepAlive = setInterval(() => res.write(": ping\n\n"), KEEPALIVE_MS);

    req.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
      res.end();
    });
  });

  return router;
}
