import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runHttpCheck } from "./http.js";
import type { CheckOptions } from "./types.js";

function opts(overrides: Partial<CheckOptions> = {}): CheckOptions {
  return {
    url: "https://example.com",
    method: "GET",
    expectedStatus: "2xx",
    keyword: null,
    keywordMode: "contains",
    timeoutMs: 5000,
    followRedirects: true,
    ...overrides,
  };
}

function redirect(to: string, status = 302): Response {
  return new Response(null, { status, headers: { location: to } });
}

describe("runHttpCheck", () => {
  beforeEach(() => {
    // los tests no salen a internet, así que el guard no tiene que resolver dominios
    process.env.TEMPO_ALLOW_PRIVATE_TARGETS = "1";
  });

  afterEach(() => {
    delete process.env.TEMPO_ALLOW_PRIVATE_TARGETS;
    vi.unstubAllGlobals();
  });

  it("un 200 con 2xx esperado está arriba", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("hola", { status: 200 })));
    const outcome = await runHttpCheck(opts());
    expect(outcome.ok).toBe(true);
    expect(outcome.httpStatus).toBe(200);
    expect(outcome.error).toBeNull();
    expect(outcome.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("un 500 está abajo y dice qué esperaba", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const outcome = await runHttpCheck(opts());
    expect(outcome.ok).toBe(false);
    expect(outcome.httpStatus).toBe(500);
    expect(outcome.error).toContain("respondió 500");
  });

  it("encuentra la palabra clave", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<h1>Francisco</h1>")));
    const outcome = await runHttpCheck(opts({ keyword: "Francisco" }));
    expect(outcome.ok).toBe(true);
  });

  it("cae cuando la palabra clave no está", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<h1>Error 500</h1>")));
    const outcome = await runHttpCheck(opts({ keyword: "Francisco" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("No se encontró");
  });

  it("cae cuando aparece una palabra que no debería estar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Database error")));
    const outcome = await runHttpCheck(opts({ keyword: "error", keywordMode: "absent" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("Apareció");
  });

  it("avisa que con HEAD no se puede buscar texto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const outcome = await runHttpCheck(opts({ method: "HEAD", keyword: "hola" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("HEAD");
  });

  it("sigue las redirecciones cuando corresponde", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect("https://example.com/final"))
      .mockResolvedValueOnce(new Response("listo", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runHttpCheck(opts());
    expect(outcome.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no sigue redirecciones si está apagado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redirect("https://example.com/final")));
    const outcome = await runHttpCheck(opts({ followRedirects: false }));
    expect(outcome.ok).toBe(false);
    expect(outcome.httpStatus).toBe(302);
  });

  it("corta el bucle de redirecciones infinitas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redirect("https://example.com/loop")));
    const outcome = await runHttpCheck(opts());
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("redirecciones");
  });

  it("informa el timeout", async () => {
    const timeout = Object.assign(new Error("abortado"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    const outcome = await runHttpCheck(opts({ timeoutMs: 3000 }));
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("Sin respuesta en 3s");
  });

  it("informa un fallo de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")));
    const outcome = await runHttpCheck(opts());
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("ENOTFOUND");
    expect(outcome.httpStatus).toBeNull();
  });

  it("no llama a fetch si el destino está bloqueado", async () => {
    delete process.env.TEMPO_ALLOW_PRIVATE_TARGETS;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runHttpCheck(opts({ url: "http://169.254.169.254/latest/meta-data/" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("privada o reservada");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("revalida el destino en cada redirección", async () => {
    delete process.env.TEMPO_ALLOW_PRIVATE_TARGETS;
    const fetchMock = vi.fn().mockResolvedValue(redirect("http://169.254.169.254/"));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runHttpCheck(opts({ url: "http://8.8.8.8/" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("privada o reservada");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
