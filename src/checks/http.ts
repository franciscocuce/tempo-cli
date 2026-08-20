import { assertAllowedTarget, BlockedTargetError } from "./guard.js";
import { statusMatches } from "./status.js";
import type { CheckOptions, CheckOutcome } from "./types.js";

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 256 * 1024;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

export async function runHttpCheck(options: CheckOptions): Promise<CheckOutcome> {
  const startedAt = performance.now();
  const signal = AbortSignal.timeout(options.timeoutMs);

  try {
    const { response, url } = await request(options, signal);
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!statusMatches(options.expectedStatus, response.status)) {
      await discard(response);
      return {
        ok: false,
        httpStatus: response.status,
        latencyMs,
        error: `Se esperaba ${options.expectedStatus} y respondió ${response.status}`,
      };
    }

    const keywordError = await checkKeyword(response, options, url);
    return {
      ok: keywordError === null,
      httpStatus: response.status,
      latencyMs,
      error: keywordError,
    };
  } catch (err) {
    return {
      ok: false,
      httpStatus: null,
      latencyMs: Math.round(performance.now() - startedAt),
      error: describe(err, options.timeoutMs),
    };
  }
}

async function request(
  options: CheckOptions,
  signal: AbortSignal
): Promise<{ response: Response; url: URL }> {
  let url = await assertAllowedTarget(options.url);

  for (let hop = 0; ; hop++) {
    const response = await fetch(url, {
      method: options.method,
      redirect: "manual",
      signal,
      headers: { "user-agent": "tempo/0.2 (+https://github.com/franciscocuce/tempo)" },
    });

    if (!options.followRedirects || !REDIRECT_CODES.has(response.status)) {
      return { response, url };
    }

    if (hop >= MAX_REDIRECTS) {
      await discard(response);
      throw new Error(`Más de ${MAX_REDIRECTS} redirecciones`);
    }

    const location = response.headers.get("location");
    await discard(response);

    if (location === null) {
      throw new Error(`Respondió ${response.status} pero sin cabecera Location`);
    }

    // cada salto se vuelve a validar: si no, una redirección a 169.254.169.254 se escapa
    url = await assertAllowedTarget(new URL(location, url).toString());
  }
}

async function checkKeyword(
  response: Response,
  options: CheckOptions,
  url: URL
): Promise<string | null> {
  if (options.keyword === null) {
    await discard(response);
    return null;
  }

  if (options.method === "HEAD") {
    await discard(response);
    return "No se puede buscar texto en una respuesta HEAD";
  }

  const body = await readBody(response);
  const found = body.includes(options.keyword);

  if (options.keywordMode === "contains" && !found) {
    return `No se encontró "${options.keyword}" en ${url.pathname}`;
  }
  if (options.keywordMode === "absent" && found) {
    return `Apareció "${options.keyword}" en ${url.pathname}`;
  }

  return null;
}

async function readBody(response: Response): Promise<string> {
  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  // sin este tope, un endpoint que devuelve un archivo enorme se come la memoria
  while (total < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    total += value.length;
  }

  await reader.cancel().catch(() => {});

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(merged);
}

async function discard(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => {});
}

function describe(err: unknown, timeoutMs: number): string {
  if (err instanceof BlockedTargetError) {
    return err.message;
  }
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return `Sin respuesta en ${timeoutMs / 1000}s`;
  }
  if (err instanceof Error) {
    return err.cause instanceof Error ? err.cause.message : err.message;
  }
  return String(err);
}
