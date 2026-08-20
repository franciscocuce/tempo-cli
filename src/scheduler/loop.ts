import type { Database } from "better-sqlite3";
import { parseExpression, matches } from "../cron/index.js";
import { listMonitors, type Monitor } from "../store/monitors.js";
import { runMaintenance } from "../store/retention.js";
import { checkMonitor, refreshCertificate } from "./runner.js";
import type { Transition } from "../incidents/state.js";

const DEFAULT_CONCURRENCY = 8;
const DEFAULT_JITTER_MS = 5_000;

// tareas internas del propio tempo, agendadas con el mismo motor cron que los monitores
const CERT_CRON = "7 4 * * *";
const MAINTENANCE_CRON = "22 4 * * *";

export interface SchedulerOptions {
  concurrency?: number;
  jitterMs?: number;
  onCheck?: (monitor: Monitor, transition: Transition) => void;
  onSkip?: (monitor: Monitor) => void;
}

export interface Scheduler {
  stop: () => Promise<void>;
}

export function dueMonitors(monitors: Monitor[], date: Date): Monitor[] {
  return monitors.filter((monitor) => {
    if (!monitor.enabled) {
      return false;
    }
    try {
      return matches(parseExpression(monitor.cron), date);
    } catch {
      console.error(`El monitor "${monitor.name}" (id ${monitor.id}) tiene un cron inválido`);
      return false;
    }
  });
}

export function startScheduler(db: Database, options: SchedulerOptions = {}): Scheduler {
  const jitterMs = options.jitterMs ?? DEFAULT_JITTER_MS;
  const limit = createLimiter(options.concurrency ?? DEFAULT_CONCURRENCY);

  // sin esto, un sitio que tarda 90s haría que el chequeo del minuto siguiente
  // arranque encima del anterior
  const inFlight = new Map<number, Promise<void>>();

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
    const monitors = listMonitors(db);

    for (const monitor of dueMonitors(monitors, now)) {
      if (inFlight.has(monitor.id)) {
        options.onSkip?.(monitor);
        continue;
      }
      track(monitor, runCheck(monitor, now));
    }

    runInternalJobs(monitors, now);
    scheduleNextTick();
  };

  const track = (monitor: Monitor, work: Promise<void>) => {
    const tracked = work.finally(() => inFlight.delete(monitor.id));
    inFlight.set(monitor.id, tracked);
  };

  const runCheck = async (monitor: Monitor, now: Date): Promise<void> => {
    await sleep(Math.random() * jitterMs);

    try {
      const transition = await limit(() => checkMonitor(db, monitor, now));
      options.onCheck?.(monitor, transition);
    } catch (err) {
      console.error(`Error inesperado chequeando "${monitor.name}":`, err);
    }
  };

  const runInternalJobs = (monitors: Monitor[], now: Date) => {
    if (fires(CERT_CRON, now)) {
      for (const monitor of monitors) {
        if (monitor.enabled && monitor.url.startsWith("https://")) {
          void limit(() => refreshCertificate(db, monitor, now)).catch(() => {});
        }
      }
    }

    if (fires(MAINTENANCE_CRON, now)) {
      try {
        runMaintenance(db, now);
      } catch (err) {
        console.error("Falló el mantenimiento de la base:", err);
      }
    }
  };

  scheduleNextTick();

  return {
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await Promise.allSettled([...inFlight.values()]);
    },
  };
}

function fires(expression: string, date: Date): boolean {
  return matches(parseExpression(expression), date);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  const release = () => {
    const resume = queue.shift();
    if (resume !== undefined) {
      resume();
      return;
    }
    active -= 1;
  };

  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    } else {
      active += 1;
    }

    try {
      return await fn();
    } finally {
      release();
    }
  };
}
