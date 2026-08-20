import { openDb } from "../db/connection.js";
import { updateMonitor } from "../store/monitors.js";
import { patchMonitorSchema, issuesToMessage } from "../store/validate.js";
import { parseId } from "./parse-id.js";

interface EditOptions {
  name?: string;
  url?: string;
  cron?: string;
  method?: string;
  expect?: string;
  keyword?: string;
  keywordMode?: string;
  timeout?: string;
  confirm?: string;
  redirects?: boolean;
  public?: boolean;
}

export function edit(rawId: string, options: EditOptions): void {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const patch = {
    name: options.name,
    url: options.url,
    cron: options.cron,
    method: options.method?.toUpperCase(),
    expectedStatus: options.expect,
    keyword: options.keyword,
    keywordMode: options.keywordMode,
    timeoutMs: options.timeout,
    confirmThreshold: options.confirm,
    followRedirects: options.redirects,
    isPublic: options.public,
  };

  const given = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(given).length === 0) {
    console.error("No pasaste ningún campo para cambiar");
    process.exitCode = 1;
    return;
  }

  const parsed = patchMonitorSchema.safeParse(given);
  if (!parsed.success) {
    console.error(issuesToMessage(parsed.error));
    process.exitCode = 1;
    return;
  }

  const db = openDb();
  try {
    const monitor = updateMonitor(db, id, parsed.data);
    if (monitor === undefined) {
      console.error(`No existe un monitor con id ${id}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Monitor "${monitor.name}" actualizado`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message.includes("UNIQUE") ? "Ya existe un monitor con ese nombre" : message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
