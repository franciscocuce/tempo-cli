import { parseExpression, nextRun } from "../cron/index.js";
import type { Monitor } from "../store/monitors.js";

export function monitorNextRun(monitor: Monitor, from: Date = new Date()): Date | null {
  if (!monitor.enabled) {
    return null;
  }

  try {
    return nextRun(parseExpression(monitor.cron), from);
  } catch {
    return null;
  }
}
