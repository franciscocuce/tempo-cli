import { Router } from "express";
import type { Database } from "better-sqlite3";
import {
  addMonitor,
  getMonitor,
  listMonitors,
  removeMonitor,
  updateMonitor,
  type Monitor,
} from "../store/monitors.js";
import { clampLimit, lastCheck, listChecks } from "../store/checks.js";
import { countOpenIncidents, getOpenIncident, listIncidents } from "../store/incidents.js";
import { monitorStats, uptimeSince } from "../store/stats.js";
import {
  addChannel,
  getChannel,
  listChannelViews,
  removeChannel,
  setChannelEnabled,
} from "../store/channels.js";
import {
  newMonitorSchema,
  patchMonitorSchema,
  newChannelSchema,
  patchChannelSchema,
  issuesToMessage,
} from "../store/validate.js";
import { checkMonitor } from "../scheduler/runner.js";
import { monitorNextRun } from "../scheduler/next-run.js";
import { send } from "../notify/index.js";
import { publishTransition } from "../events/publish.js";
import type { EventBus } from "../events/bus.js";

function parseIdParam(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// express parsea ?a[b]=1 como objeto y ?a=1&a=2 como array, así que un query param
// no es necesariamente un string. Lo que no sea string se descarta
function queryString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function withStatus(db: Database, monitor: Monitor, now: Date) {
  const last = lastCheck(db, monitor.id);
  const open = getOpenIncident(db, monitor.id);

  return {
    ...monitor,
    nextRun: monitorNextRun(monitor, now)?.toISOString() ?? null,
    status: statusOf(monitor, open !== undefined, last !== undefined),
    lastCheckedAt: last?.checkedAt ?? null,
    lastLatencyMs: last?.latencyMs ?? null,
    lastError: last?.error ?? null,
    openIncidentSince: open?.startedAt ?? null,
    uptime24h: uptimeSince(db, monitor.id, new Date(now.getTime() - 86_400_000)).percent,
  };
}

function statusOf(monitor: Monitor, down: boolean, checked: boolean): string {
  if (!monitor.enabled) {
    return "paused";
  }
  if (!checked) {
    return "pending";
  }
  return down ? "down" : "up";
}

export function createApiRouter(db: Database, bus: EventBus): Router {
  const router = Router();

  router.get("/monitors", (_req, res) => {
    const now = new Date();
    res.json(listMonitors(db).map((monitor) => withStatus(db, monitor, now)));
  });

  router.post("/monitors", (req, res) => {
    const parsed = newMonitorSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: issuesToMessage(parsed.error) });
      return;
    }

    try {
      const monitor = addMonitor(db, parsed.data);
      res.status(201).json(withStatus(db, monitor, new Date()));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE")) {
        res.status(409).json({ error: `Ya existe un monitor con el nombre "${parsed.data.name}"` });
        return;
      }
      res.status(500).json({ error: message });
    }
  });

  router.get("/monitors/:id", (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const monitor = getMonitor(db, id);
    if (monitor === undefined) {
      res.status(404).json({ error: `No existe un monitor con id ${id}` });
      return;
    }

    res.json(withStatus(db, monitor, new Date()));
  });

  router.patch("/monitors/:id", (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const parsed = patchMonitorSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: issuesToMessage(parsed.error) });
      return;
    }

    try {
      const monitor = updateMonitor(db, id, parsed.data);
      if (monitor === undefined) {
        res.status(404).json({ error: `No existe un monitor con id ${id}` });
        return;
      }
      res.json(withStatus(db, monitor, new Date()));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE")) {
        res.status(409).json({ error: "Ya existe un monitor con ese nombre" });
        return;
      }
      res.status(500).json({ error: message });
    }
  });

  router.delete("/monitors/:id", (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    if (!removeMonitor(db, id)) {
      res.status(404).json({ error: `No existe un monitor con id ${id}` });
      return;
    }
    res.status(204).end();
  });

  router.post("/monitors/:id/check", async (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const monitor = getMonitor(db, id);
    if (monitor === undefined) {
      res.status(404).json({ error: `No existe un monitor con id ${id}` });
      return;
    }

    const transition = await checkMonitor(db, monitor);
    publishTransition(bus, monitor, transition);

    res.json({
      ...transition.outcome,
      opened: transition.opened,
      resolved: transition.resolved,
    });
  });

  router.get("/monitors/:id/checks", (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }
    res.json(listChecks(db, { monitorId: id, limit: clampLimit(req.query.limit) }));
  });

  router.get("/monitors/:id/stats", (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }
    if (getMonitor(db, id) === undefined) {
      res.status(404).json({ error: `No existe un monitor con id ${id}` });
      return;
    }
    res.json(monitorStats(db, id));
  });

  router.get("/checks", (req, res) => {
    const monitorId = parseIdParam(queryString(req.query.monitor));
    res.json(
      listChecks(db, {
        monitorId: monitorId ?? undefined,
        limit: clampLimit(req.query.limit),
      }),
    );
  });

  router.get("/incidents", (req, res) => {
    const monitorId = parseIdParam(queryString(req.query.monitor));
    res.json(
      listIncidents(db, {
        monitorId: monitorId ?? undefined,
        limit: clampLimit(req.query.limit),
        onlyOpen: req.query.open === "true",
      }),
    );
  });

  router.get("/overview", (_req, res) => {
    const now = new Date();
    const monitors = listMonitors(db);
    const withData = monitors.map((monitor) => withStatus(db, monitor, now));
    const uptimes = withData.map((m) => m.uptime24h).filter((v): v is number => v !== null);

    res.json({
      total: monitors.length,
      active: monitors.filter((m) => m.enabled).length,
      down: withData.filter((m) => m.status === "down").length,
      openIncidents: countOpenIncidents(db),
      uptime24h:
        uptimes.length === 0
          ? null
          : Math.round((uptimes.reduce((a, b) => a + b, 0) / uptimes.length) * 100) / 100,
    });
  });

  router.get("/channels", (_req, res) => {
    res.json(listChannelViews(db));
  });

  router.post("/channels", (req, res) => {
    const parsed = newChannelSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: issuesToMessage(parsed.error) });
      return;
    }

    try {
      res.status(201).json(addChannel(db, parsed.data));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.patch("/channels/:id", (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }
    const parsed = patchChannelSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: issuesToMessage(parsed.error) });
      return;
    }
    if (!setChannelEnabled(db, id, parsed.data.enabled)) {
      res.status(404).json({ error: `No existe un canal con id ${id}` });
      return;
    }
    res.json(listChannelViews(db).find((channel) => channel.id === id));
  });

  router.delete("/channels/:id", (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }
    if (!removeChannel(db, id)) {
      res.status(404).json({ error: `No existe un canal con id ${id}` });
      return;
    }
    res.status(204).end();
  });

  router.post("/channels/:id/test", async (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const channel = getChannel(db, id);
    if (channel === undefined) {
      res.status(404).json({ error: `No existe un canal con id ${id}` });
      return;
    }

    try {
      await send(channel, {
        kind: "up",
        monitorName: "prueba",
        url: "https://example.com",
        detail: "Aviso de prueba desde tempo",
        at: new Date(),
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
