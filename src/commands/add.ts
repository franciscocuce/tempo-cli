import { openDb } from "../db/connection.js";
import { addMonitor } from "../store/monitors.js";
import { newMonitorSchema } from "../store/validate.js";
import { parseExpression, nextRun } from "../cron/index.js";

interface AddOptions {
  name: string;
  url: string;
  cron: string;
  method?: string;
  expect?: string;
  keyword?: string;
  keywordMode?: string;
  timeout?: string;
  redirects?: boolean;
  confirm?: string;
  private?: boolean;
}

export function add(options: AddOptions): void {
  const parsed = newMonitorSchema.safeParse({
    name: options.name,
    url: options.url,
    cron: options.cron,
    method: options.method?.toUpperCase(),
    expectedStatus: options.expect,
    keyword: options.keyword ?? null,
    keywordMode: options.keywordMode,
    timeoutMs: options.timeout,
    followRedirects: options.redirects !== false,
    confirmThreshold: options.confirm,
    isPublic: options.private !== true,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      console.error(issue.message);
    }
    process.exitCode = 1;
    return;
  }

  const db = openDb();
  try {
    const monitor = addMonitor(db, parsed.data);
    const next = nextRun(parseExpression(monitor.cron), new Date());
    console.log(`Monitor "${monitor.name}" creado con id ${monitor.id}`);
    console.log(`Próximo chequeo: ${next.toLocaleString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      message.includes("UNIQUE")
        ? `Ya existe un monitor con el nombre "${options.name}"`
        : message
    );
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
