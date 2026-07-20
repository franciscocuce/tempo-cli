import type { Task } from "../store/tasks.js";
import { parseExpression, nextRun } from "../cron/index.js";

export function taskNextRun(task: Task, from: Date = new Date()): Date | null {
  if (!task.enabled) {
    return null;
  }
  return nextRun(parseExpression(task.cron), from);
}
