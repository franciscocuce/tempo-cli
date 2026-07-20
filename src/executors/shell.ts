import { exec } from "node:child_process";
import type { ExecutionResult } from "./types.js";

const TIMEOUT_MS = 60_000;

export function executeShell(command: string): Promise<ExecutionResult> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    exec(command, { timeout: TIMEOUT_MS }, (err, stdout, stderr) => {
      const durationMs = Date.now() - startedAt;
      const output = [stdout, stderr].filter((s) => s.trim() !== "").join("\n").trim();

      if (err === null) {
        resolve({ status: "ok", output, durationMs });
        return;
      }

      // exec mata el proceso con una señal cuando vence el timeout
      const reason = err.killed
        ? `timeout: el comando superó los ${TIMEOUT_MS / 1000}s`
        : `exit code ${err.code ?? "?"}`;

      resolve({
        status: "error",
        output: output === "" ? reason : `${reason}\n${output}`,
        durationMs,
      });
    });
  });
}
