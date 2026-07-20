import { describe, it, expect, vi, afterEach } from "vitest";
import { executeHttp } from "./http.js";

function fakeResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

describe("executeHttp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve ok con un 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(200, "pong")));
    const result = await executeHttp("https://example.com");
    expect(result.status).toBe("ok");
    expect(result.output).toContain("HTTP 200");
    expect(result.output).toContain("pong");
  });

  it("devuelve error con un 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(500, "boom")));
    const result = await executeHttp("https://example.com");
    expect(result.status).toBe("error");
    expect(result.output).toContain("HTTP 500");
  });

  it("devuelve error si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")));
    const result = await executeHttp("https://no-existe.example");
    expect(result.status).toBe("error");
    expect(result.output).toContain("ENOTFOUND");
  });

  it("recorta el body largo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(200, "x".repeat(2000))));
    const result = await executeHttp("https://example.com");
    expect(result.output.length).toBeLessThan(600);
  });
});
