import type { Task } from "../store/tasks.js";
import type { ExecutionResult } from "./types.js";
import { executeShell } from "./shell.js";
import { executeHttp } from "./http.js";

const MAX_OUTPUT_CHARS = 4000;

export async function executeTask(task: Task): Promise<ExecutionResult> {
  const result =
    task.type === "shell"
      ? await executeShell(task.payload)
      : await executeHttp(task.payload);

  return { ...result, output: result.output.slice(0, MAX_OUTPUT_CHARS) };
}

export type { ExecutionResult } from "./types.js";
