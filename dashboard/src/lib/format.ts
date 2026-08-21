export function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000);

  if (minutes < 1) {
    return "<1 min";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours < 24) {
    return restMinutes === 0 ? `${hours} h` : `${hours} h ${restMinutes} min`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}

export function relative(iso: string | null, now: number = Date.now()): string {
  if (iso === null) {
    return "—";
  }

  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);

  if (abs < 45_000) {
    return diff < 0 ? "recién" : "en un momento";
  }

  const text = duration(abs);
  return diff < 0 ? `hace ${text}` : `en ${text}`;
}

export function dateTime(iso: string | null): string {
  return iso === null ? "—" : new Date(iso).toLocaleString();
}

export function percent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(value >= 99.95 || value === 0 ? 0 : 2)}%`;
}

export function latency(ms: number | null): string {
  return ms === null ? "—" : `${ms} ms`;
}

const EVERY_MINUTES = /^\*\/(\d+) \* \* \* \*$/;
const EVERY_HOURS = /^(\d+) \*\/(\d+) \* \* \*$/;
const HOURLY = /^(\d+) \* \* \* \*$/;
const DAILY = /^(\d+) (\d+) \* \* \*$/;

// no cubre todo el lenguaje cron, solo las formas que se usan de verdad para monitorear.
// si no la reconoce, muestra la expresión tal cual
export function cronToText(expression: string): string {
  const trimmed = expression.trim();

  if (trimmed === "* * * * *") {
    return "cada minuto";
  }

  const minutes = EVERY_MINUTES.exec(trimmed);
  if (minutes !== null) {
    return `cada ${minutes[1]} minutos`;
  }

  const hours = EVERY_HOURS.exec(trimmed);
  if (hours !== null) {
    return `cada ${hours[2]} horas`;
  }

  if (HOURLY.test(trimmed)) {
    return "cada hora";
  }

  const daily = DAILY.exec(trimmed);
  if (daily !== null) {
    return `todos los días a las ${daily[2].padStart(2, "0")}:${daily[1].padStart(2, "0")}`;
  }

  return trimmed;
}

export function certText(iso: string | null): { text: string; level: "ok" | "warn" | "down" } {
  if (iso === null) {
    return { text: "—", level: "ok" };
  }

  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

  if (days < 0) {
    return { text: `vencido hace ${Math.abs(days)} d`, level: "down" };
  }
  if (days <= 14) {
    return { text: `vence en ${days} d`, level: "warn" };
  }
  return { text: `vence en ${days} d`, level: "ok" };
}
