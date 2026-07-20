import { Router } from "express";
import type { Database } from "better-sqlite3";
import {
  addTask,
  listTasks,
  getTask,
  removeTask,
  setTaskEnabled,
} from "../store/tasks.js";
import { addRun, listRuns } from "../store/runs.js";
import { newTaskSchema } from "../store/validate.js";
import { executeTask } from "../executors/index.js";
import { taskNextRun } from "../scheduler/next-run.js";

function parseIdParam(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function createApiRouter(db: Database): Router {
  const router = Router();

  router.get("/tasks", (_req, res) => {
    const now = new Date();
    const tasks = listTasks(db).map((task) => ({
      ...task,
      nextRun: taskNextRun(task, now)?.toISOString() ?? null,
    }));
    res.json(tasks);
  });

  router.post("/tasks", (req, res) => {
    const body = req.body ?? {};
    const payload = body.type === "http" ? body.url : body.command;

    const parsed = newTaskSchema.safeParse({
      name: body.name,
      cron: body.cron,
      type: body.type,
      payload: payload ?? "",
    });

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }

    try {
      const task = addTask(db, parsed.data);
      res.status(201).json(task);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE")) {
        res.status(409).json({ error: `Ya existe una tarea con el nombre "${parsed.data.name}"` });
        return;
      }
      res.status(500).json({ error: message });
    }
  });

  router.patch("/tasks/:id", (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }
    if (typeof req.body?.enabled !== "boolean") {
      res.status(400).json({ error: "Falta el campo enabled (boolean)" });
      return;
    }

    const ok = setTaskEnabled(db, id, req.body.enabled);
    if (!ok) {
      res.status(404).json({ error: `No existe una tarea con id ${id}` });
      return;
    }
    res.json(getTask(db, id));
  });

  router.delete("/tasks/:id", (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const ok = removeTask(db, id);
    if (!ok) {
      res.status(404).json({ error: `No existe una tarea con id ${id}` });
      return;
    }
    res.status(204).end();
  });

  router.post("/tasks/:id/run", async (req, res) => {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const task = getTask(db, id);
    if (task === undefined) {
      res.status(404).json({ error: `No existe una tarea con id ${id}` });
      return;
    }

    const startedAt = new Date();
    const result = await executeTask(task);
    addRun(db, {
      taskId: task.id,
      startedAt: startedAt.toISOString(),
      durationMs: result.durationMs,
      status: result.status,
      output: result.output,
    });
    res.json(result);
  });

  router.get("/runs", (req, res) => {
    const taskId = req.query.task !== undefined ? Number(req.query.task) : undefined;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    res.json(
      listRuns(db, {
        taskId: Number.isInteger(taskId) ? taskId : undefined,
        limit: Number.isInteger(limit) ? limit : undefined,
      })
    );
  });

  return router;
}
