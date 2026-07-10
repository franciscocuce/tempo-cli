import type { CronSchedule } from "./parser.js";

const MAX_MINUTES = 5 * 366 * 24 * 60;

export function nextRun(schedule: CronSchedule, from: Date): Date {
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  for (let i = 0; i < MAX_MINUTES; i++) {
    if (matches(schedule, candidate)) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error(
    "No se encontró un próximo disparo dentro del horizonte de búsqueda (5 años)"
  );
}

export function matches(schedule: CronSchedule, date: Date): boolean {
  const minuteOk = schedule.minute.values.includes(date.getMinutes());
  const hourOk = schedule.hour.values.includes(date.getHours());
  const monthOk = schedule.month.values.includes(date.getMonth() + 1);

  if (!minuteOk || !hourOk || !monthOk) {
    return false;
  }

  const domOk = schedule.dayOfMonth.values.includes(date.getDate());
  const dowOk = schedule.dayOfWeek.values.includes(date.getDay());

  if (schedule.dayOfMonth.restricted && schedule.dayOfWeek.restricted) {
    return domOk || dowOk;
  }

  return domOk && dowOk;
}
