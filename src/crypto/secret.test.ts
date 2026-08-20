import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, maskUrl, generateSecretKey } from "./secret.js";

const WEBHOOK = "https://discord.com/api/webhooks/123456789/tokenSuperSecreto";

describe("secretos", () => {
  beforeEach(() => {
    process.env.TEMPO_SECRET_KEY = "clave-de-prueba-para-los-tests";
  });

  afterEach(() => {
    delete process.env.TEMPO_SECRET_KEY;
  });

  it("va y vuelve sin perder nada", () => {
    expect(decrypt(encrypt(WEBHOOK))).toBe(WEBHOOK);
  });

  it("el mismo texto cifrado dos veces da distinto", () => {
    expect(encrypt(WEBHOOK)).not.toBe(encrypt(WEBHOOK));
  });

  it("el texto cifrado no contiene el original", () => {
    expect(encrypt(WEBHOOK)).not.toContain("tokenSuperSecreto");
  });

  it("detecta que le tocaron el contenido", () => {
    const [iv, tag, data] = encrypt(WEBHOOK).split(".");
    const roto = [iv, tag, data.slice(0, -2) + "AA"].join(".");
    expect(() => decrypt(roto)).toThrow();
  });

  it("rechaza un formato que no tiene las tres partes", () => {
    expect(() => decrypt("cualquier-cosa")).toThrowError(/formato inválido/);
  });

  it("no descifra con otra clave", () => {
    const cifrado = encrypt(WEBHOOK);
    process.env.TEMPO_SECRET_KEY = "otra-clave-distinta";
    expect(() => decrypt(cifrado)).toThrow();
  });

  it("avisa si falta la clave", () => {
    delete process.env.TEMPO_SECRET_KEY;
    expect(() => encrypt(WEBHOOK)).toThrowError(/TEMPO_SECRET_KEY/);
  });

  it("genera claves de 32 bytes en hexa", () => {
    expect(generateSecretKey()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("maskUrl", () => {
  it("tapa el último segmento, que es el token", () => {
    expect(maskUrl(WEBHOOK)).toBe("https://discord.com/api/webhooks/123456789/••••");
  });

  it("tapa la raíz cuando no hay path", () => {
    expect(maskUrl("https://example.com")).toBe("https://example.com/••••");
  });

  it("no explota con algo que no es una url", () => {
    expect(maskUrl("no soy una url")).toBe("••••");
  });
});
