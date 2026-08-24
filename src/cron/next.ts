import type { CronSchedule } from "./parser.js";

const HORIZON_YEARS = 5;

export function nextRun(schedule: CronSchedule, from: Date): Date {
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const limit = new Date(from);
  limit.setFullYear(limit.getFullYear() + HORIZON_YEARS);

  // en vez de probar minuto a minuto, saltamos al principio del próximo mes/día/hora
  // en cuanto sabemos que ese bloque entero no puede matchear
  while (candidate <= limit) {
    if (!schedule.month.values.includes(candidate.getMonth() + 1)) {
      startOfNextMonth(candidate);
      continue;
    }

    if (!dayMatches(schedule, candidate)) {
      startOfNextDay(candidate);
      continue;
    }

    if (!schedule.hour.values.includes(candidate.getHours())) {
      startOfNextHour(candidate);
      continue;
    }

    if (!schedule.minute.values.includes(candidate.getMinutes())) {
      candidate.setMinutes(candidate.getMinutes() + 1);
      continue;
    }

    return candidate;
  }

  throw new Error(
    `No se encontró un próximo disparo dentro del horizonte de búsqueda (${HORIZON_YEARS} años)`,
  );
}

export function matches(schedule: CronSchedule, date: Date): boolean {
  return (
    schedule.minute.values.includes(date.getMinutes()) &&
    schedule.hour.values.includes(date.getHours()) &&
    schedule.month.values.includes(date.getMonth() + 1) &&
    dayMatches(schedule, date)
  );
}

// la regla clásica de cron: si los dos campos de día están restringidos, alcanza con que
// matchee uno de los dos
function dayMatches(schedule: CronSchedule, date: Date): boolean {
  const domOk = schedule.dayOfMonth.values.includes(date.getDate());
  const dowOk = schedule.dayOfWeek.values.includes(date.getDay());

  if (schedule.dayOfMonth.restricted && schedule.dayOfWeek.restricted) {
    return domOk || dowOk;
  }

  return domOk && dowOk;
}

function startOfNextMonth(date: Date): void {
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
}

function startOfNextDay(date: Date): void {
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
}

function startOfNextHour(date: Date): void {
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
}
