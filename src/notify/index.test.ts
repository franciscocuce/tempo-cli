import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispatch, buildPayload } from "./index.js";
import type { Alert, Channel } from "./types.js";

const alert: Alert = {
  kind: "down",
  monitorName: "portfolio",
  url: "https://franciscocuce.dev",
  detail: "Se esperaba 2xx y respondió 500",
  at: new Date("2026-08-20T12:00:00.000Z"),
};

function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 1,
    type: "discord",
    label: "mi discord",
    target: "https://discord.com/api/webhooks/123/token",
    enabled: true,
    ...overrides,
  };
}

describe("buildPayload", () => {
  it("arma un embed rojo cuando algo se cae", () => {
    const payload = buildPayload(alert) as { embeds: { title: string; color: number }[] };
    expect(payload.embeds[0].title).toContain("está caído");
    expect(payload.embeds[0].color).toBe(0xe5484d);
  });

  it("arma un embed verde cuando se recupera", () => {
    const payload = buildPayload({ ...alert, kind: "up" }) as {
      embeds: { title: string; color: number }[];
    };
    expect(payload.embeds[0].title).toContain("volvió");
    expect(payload.embeds[0].color).toBe(0x30a46c);
  });

  it("arma un embed ámbar para el certificado", () => {
    const payload = buildPayload({ ...alert, kind: "cert" }) as {
      embeds: { title: string; color: number }[];
    };
    expect(payload.embeds[0].title).toContain("certificado");
    expect(payload.embeds[0].color).toBe(0xf5a524);
  });
});

describe("dispatch", () => {
  beforeEach(() => {
    process.env.TEMPO_ALLOW_PRIVATE_TARGETS = "1";
  });

  afterEach(() => {
    delete process.env.TEMPO_ALLOW_PRIVATE_TARGETS;
    vi.unstubAllGlobals();
  });

  it("manda a los canales activos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await dispatch([channel(), channel({ id: 2 })], alert);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("saltea los canales apagados", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await dispatch([channel({ enabled: false })], alert);
    expect(results).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un canal roto no frena a los demás", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await dispatch([channel(), channel({ id: 2 })], alert);
    expect(results[0]).toMatchObject({ channelId: 1, ok: false });
    expect(results[0].error).toContain("ECONNRESET");
    expect(results[1]).toMatchObject({ channelId: 2, ok: true });
  });

  it("informa cuando discord contesta con error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));

    const [result] = await dispatch([channel()], alert);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("401");
  });

  it("no manda nada a un webhook con destino bloqueado", async () => {
    delete process.env.TEMPO_ALLOW_PRIVATE_TARGETS;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const [result] = await dispatch([channel({ target: "http://127.0.0.1/webhook" })], alert);
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
