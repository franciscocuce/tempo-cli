import type { Database } from "better-sqlite3";
import { parseExpression, matches } from "../cron/index.js";
import { listTasks, type Task } from "../store/tasks.js";
import { addRun } from "../store/runs.js";
import { executeTask } from "../executors/index.js";

export function dueTasks(tasks: Task[], date: Date): Task[] {
  return tasks.filter((task) => {
    if (!task.enabled) {
      return false;
    }
    try {
      return matches(parseExpression(task.cron), date);
    } catch {
      // un cron roto en la DB no puede tirar abajo el scheduler
      console.error(`Tarea "${task.name}" (id ${task.id}) tiene un cron inválido, se saltea`);
      return false;
    }
  });
}

export interface Scheduler {
  stop: () => void;
}

export function startScheduler(db: Database): Scheduler {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const scheduleNextTick = () => {
    if (stopped) {
      return;
    }
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    timer = setTimeout(tick, msToNextMinute);
  };

  const tick = () => {
    const now = new Date();
    for (const task of dueTasks(listTasks(db), now)) {
      fireTask(db, task, now);
    }
    scheduleNextTick();
  };

  scheduleNextTick();

  return {
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

function fireTask(db: Database, task: Task, startedAt: Date): void {
  // sin await: una tarea lenta no puede atrasar el tick
  executeTask(task)
    .then((result) => {
      addRun(db, {
        taskId: task.id,
        startedAt: startedAt.toISOString(),
        durationMs: result.durationMs,
        status: result.status,
        output: result.output,
      });
      console.log(
        `[${startedAt.toLocaleTimeString()}] ${task.name} → ${result.status} (${result.durationMs}ms)`
      );
    })
    .catch((err) => {
      console.error(`Error inesperado ejecutando "${task.name}":`, err);
    });
}
