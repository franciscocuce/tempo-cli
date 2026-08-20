import type { Database } from "better-sqlite3";
import { acquireLock, lockHolder, type Lock } from "./lock.js";
import { startScheduler, type Scheduler } from "./loop.js";
import type { Monitor } from "../store/monitors.js";
import type { Transition } from "../incidents/state.js";

export interface Daemon {
  stop: () => Promise<void>;
}

export class AlreadyRunningError extends Error {}

export function startDaemon(db: Database): Daemon {
  const lock: Lock | null = acquireLock(db);

  if (lock === null) {
    const holder = lockHolder(db);
    throw new AlreadyRunningError(
      `Ya hay un tempo vigilando esta base (pid ${holder?.pid} en ${holder?.host}). ` +
        "Dos schedulers sobre la misma base chequearían todo dos veces."
    );
  }

  const scheduler: Scheduler = startScheduler(db, { onCheck: logCheck, onSkip: logSkip });

  return {
    stop: async () => {
      await scheduler.stop();
      lock.release();
    },
  };
}

function logCheck(monitor: Monitor, transition: Transition): void {
  const time = new Date().toLocaleTimeString();
  const { outcome } = transition;
  const status = outcome.ok ? "ok" : "FALLÓ";

  console.log(`[${time}] ${monitor.name} → ${status} (${outcome.latencyMs}ms)`);

  if (transition.opened) {
    console.log(`[${time}] incidente abierto en ${monitor.name}: ${outcome.error}`);
  }
  if (transition.resolved) {
    console.log(`[${time}] ${monitor.name} se recuperó`);
  }
}

function logSkip(monitor: Monitor): void {
  console.log(
    `[${new Date().toLocaleTimeString()}] ${monitor.name} sigue respondiendo del chequeo anterior, se saltea`
  );
}
