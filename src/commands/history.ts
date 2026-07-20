import { openDb } from "../db/connection.js";
import { listRuns } from "../store/runs.js";
import { parseId } from "./parse-id.js";

const OUTPUT_PREVIEW_CHARS = 60;

interface HistoryOptions {
  task?: string;
  limit?: string;
}

export function history(options: HistoryOptions): void {
  let taskId: number | undefined;
  if (options.task !== undefined) {
    taskId = parseId(options.task);
    if (taskId === undefined) {
      return;
    }
  }

  const limit = options.limit !== undefined ? Number(options.limit) : 20;
  if (!Number.isInteger(limit) || limit <= 0) {
    console.error(`"${options.limit}" no es un límite válido`);
    process.exitCode = 1;
    return;
  }

  const db = openDb();
  try {
    const runs = listRuns(db, { taskId, limit });

    if (runs.length === 0) {
      console.log("Todavía no hay ejecuciones registradas");
      return;
    }

    const rows = runs.map((run) => ({
      fecha: new Date(run.startedAt).toLocaleString(),
      tarea: run.taskName,
      estado: run.status,
      "duración": `${run.durationMs}ms`,
      output: run.output.replace(/\s+/g, " ").slice(0, OUTPUT_PREVIEW_CHARS),
    }));

    console.table(rows);
  } finally {
    db.close();
  }
}
