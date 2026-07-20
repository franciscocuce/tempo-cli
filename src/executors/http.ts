import type { ExecutionResult } from "./types.js";

const TIMEOUT_MS = 30_000;
const BODY_PREVIEW_CHARS = 500;

export async function executeHttp(url: string): Promise<ExecutionResult> {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await response.text();
    const durationMs = Date.now() - startedAt;

    const preview = body.slice(0, BODY_PREVIEW_CHARS).trim();
    const output = preview === "" ? `HTTP ${response.status}` : `HTTP ${response.status}\n${preview}`;

    return {
      status: response.ok ? "ok" : "error",
      output,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? `timeout: sin respuesta en ${TIMEOUT_MS / 1000}s`
        : err instanceof Error
          ? err.message
          : String(err);

    return { status: "error", output: message, durationMs };
  }
}
