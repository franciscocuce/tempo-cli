import { openDb } from "../db/connection.js";
import { getTask } from "../store/tasks.js";
import { addRun } from "../store/runs.js";
import { executeTask } from "../executors/index.js";
import { parseId } from "./parse-id.js";

export async function run(rawId: string): Promise<void> {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const db = openDb();
  try {
    const task = getTask(db, id);
    if (task === undefined) {
      console.error(`No existe una tarea con id ${id}`);
      process.exitCode = 1;
      return;
    }

    const startedAt = new Date();
    console.log(`Ejecutando "${task.name}" (${task.type})...`);

    const result = await executeTask(task);

    addRun(db, {
      taskId: task.id,
      startedAt: startedAt.toISOString(),
      durationMs: result.durationMs,
      status: result.status,
      output: result.output,
    });

    console.log(`Estado: ${result.status} (${result.durationMs}ms)`);
    if (result.output !== "") {
      console.log(result.output);
    }
    if (result.status === "error") {
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}
