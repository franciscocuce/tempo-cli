import { describe, it, expect } from "vitest";
import {
  newMonitorSchema,
  patchMonitorSchema,
  newChannelSchema,
  issuesToMessage,
} from "./validate.js";

const base = {
  name: "portfolio",
  url: "https://franciscocuce.dev",
  cron: "*/5 * * * *",
  keyword: null,
};

function parse(overrides: Record<string, unknown> = {}) {
  return newMonitorSchema.safeParse({ ...base, ...overrides });
}

describe("newMonitorSchema", () => {
  it("acepta un monitor mínimo y completa los valores por defecto", () => {
    const result = parse();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe("GET");
      expect(result.data.expectedStatus).toBe("2xx");
      expect(result.data.timeoutMs).toBe(10_000);
      expect(result.data.confirmThreshold).toBe(2);
      expect(result.data.followRedirects).toBe(true);
      expect(result.data.isPublic).toBe(true);
    }
  });

  it("rechaza un nombre vacío", () => {
    expect(parse({ name: "   " }).success).toBe(false);
  });

  it("rechaza una URL que no es http ni https", () => {
    const result = parse({ url: "ftp://example.com" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/http y https/);
    }
  });

  it("rechaza un cron inválido", () => {
    expect(parse({ cron: "cada rato" }).success).toBe(false);
  });

  it("rechaza un estado esperado que no se entiende", () => {
    expect(parse({ expectedStatus: "doscientos" }).success).toBe(false);
  });

  it("acepta las formas válidas de estado esperado", () => {
    for (const expectedStatus of ["200", "2xx", "200-299", "200,301"]) {
      expect(parse({ expectedStatus }).success).toBe(true);
    }
  });

  it("convierte una palabra clave vacía en null", () => {
    const result = parse({ keyword: "  " });
    expect(result.success && result.data.keyword).toBeNull();
  });

  it("la palabra clave es opcional como el resto de los campos con default", () => {
    const { keyword: _omitida, ...sinKeyword } = base;
    const result = newMonitorSchema.safeParse(sinKeyword);

    expect(result.success).toBe(true);
    expect(result.success && result.data.keyword).toBeNull();
  });

  it("rechaza una IP privada o reservada escrita en la URL", () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:3000/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://[::1]/",
    ]) {
      const result = parse({ url });
      expect(result.success, url).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/privada o reservada/);
      }
    }
  });

  it("deja pasar los dominios, que se resuelven recién al chequear", () => {
    expect(parse({ url: "https://example.com" }).success).toBe(true);
  });

  it("no deja buscar texto en una respuesta HEAD", () => {
    const result = parse({ method: "HEAD", keyword: "hola" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/HEAD/);
    }
  });

  it("rechaza timeouts fuera de rango", () => {
    expect(parse({ timeoutMs: 100 }).success).toBe(false);
    expect(parse({ timeoutMs: 120_000 }).success).toBe(false);
  });

  it("rechaza un umbral de confirmación absurdo", () => {
    expect(parse({ confirmThreshold: 0 }).success).toBe(false);
    expect(parse({ confirmThreshold: 50 }).success).toBe(false);
  });

  it("rechaza un método que no está permitido", () => {
    expect(parse({ method: "DELETE" }).success).toBe(false);
  });
});

describe("issuesToMessage", () => {
  it("dice qué campo falla y no solo qué le pasa", () => {
    const result = newMonitorSchema.safeParse({ url: "https://example.com" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const message = issuesToMessage(result.error);
      expect(message).toContain("name:");
      expect(message).toContain("cron:");
    }
  });

  it("junta todos los problemas en un solo mensaje", () => {
    const result = parse({ name: "  ", cron: "cada rato" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issuesToMessage(result.error).split(", ").length).toBeGreaterThan(1);
    }
  });
});

describe("patchMonitorSchema", () => {
  it("acepta un objeto vacío", () => {
    expect(patchMonitorSchema.safeParse({}).success).toBe(true);
  });

  it("acepta cambiar solo el estado", () => {
    const result = patchMonitorSchema.safeParse({ enabled: false });
    expect(result.success && result.data.enabled).toBe(false);
  });

  it("sigue validando lo que sí viene", () => {
    expect(patchMonitorSchema.safeParse({ cron: "no es cron" }).success).toBe(false);
  });
});

describe("newChannelSchema", () => {
  it("acepta un webhook de discord", () => {
    const result = newChannelSchema.safeParse({
      type: "discord",
      label: "mi server",
      target: "https://discord.com/api/webhooks/1/abc",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un tipo desconocido", () => {
    const result = newChannelSchema.safeParse({
      type: "telegram",
      label: "x",
      target: "https://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un destino que no es una URL", () => {
    const result = newChannelSchema.safeParse({ type: "discord", label: "x", target: "pepe" });
    expect(result.success).toBe(false);
  });
});
