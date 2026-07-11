import { openDb } from "../db/connection.js";
import { addTask } from "../store/tasks.js";
import { newTaskSchema } from "../store/validate.js";
import { parseExpression, nextRun } from "../cron/index.js";

interface AddOptions {
  name: string;
  cron: string;
  type: string;
  command?: string;
  url?: string;
}

export function add(options: AddOptions): void {
  if (options.command !== undefined && options.url !== undefined) {
    console.error("Usá --command o --url, no los dos");
    process.exitCode = 1;
    return;
  }

  const payload = options.type === "http" ? options.url : options.command;

  const parsed = newTaskSchema.safeParse({
    name: options.name,
    cron: options.cron,
    type: options.type,
    payload: payload ?? "",
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
    const task = addTask(db, parsed.data);
    const next = nextRun(parseExpression(task.cron), new Date());
    console.log(`Tarea "${task.name}" creada con id ${task.id}`);
    console.log(`Próximo disparo: ${next.toLocaleString()}`);
  } catch (err) {
    // el UNIQUE de name salta acá si el nombre ya existe
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      message.includes("UNIQUE")
        ? `Ya existe una tarea con el nombre "${options.name}"`
        : message
    );
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
