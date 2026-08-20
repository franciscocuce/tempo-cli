import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { certInfo, isExpiringSoon, readCertificate } from "./cert.js";

const NOW = new Date("2026-08-20T00:00:00.000Z");

describe("certInfo", () => {
  it("calcula los días que faltan", () => {
    const info = certInfo({ valid_to: "Sep 19 12:00:00 2026 GMT" }, NOW);
    expect(info?.daysLeft).toBe(31);
  });

  it("devuelve días negativos si ya venció", () => {
    const info = certInfo({ valid_to: "Aug 10 12:00:00 2026 GMT" }, NOW);
    expect(info?.daysLeft).toBeLessThan(0);
  });

  it("saca el emisor del certificado", () => {
    const info = certInfo({ valid_to: "Sep 19 12:00:00 2026 GMT", issuer: { O: "Let's Encrypt" } }, NOW);
    expect(info?.issuer).toBe("Let's Encrypt");
  });

  it("se banca un certificado sin emisor", () => {
    expect(certInfo({ valid_to: "Sep 19 12:00:00 2026 GMT" }, NOW)?.issuer).toBeNull();
  });

  it("devuelve null si no hay fecha de vencimiento", () => {
    expect(certInfo({}, NOW)).toBeNull();
  });

  it("devuelve null si la fecha no se entiende", () => {
    expect(certInfo({ valid_to: "cualquier cosa" }, NOW)).toBeNull();
  });
});

describe("isExpiringSoon", () => {
  it("avisa dentro de la ventana", () => {
    const info = certInfo({ valid_to: "Aug 30 12:00:00 2026 GMT" }, NOW)!;
    expect(isExpiringSoon(info)).toBe(true);
  });

  it("no avisa si falta mucho", () => {
    const info = certInfo({ valid_to: "Dec 30 12:00:00 2026 GMT" }, NOW)!;
    expect(isExpiringSoon(info)).toBe(false);
  });
});

describe("readCertificate", () => {
  beforeEach(() => {
    process.env.TEMPO_ALLOW_PRIVATE_TARGETS = "1";
  });

  afterEach(() => {
    delete process.env.TEMPO_ALLOW_PRIVATE_TARGETS;
  });

  it("no intenta leer un certificado en http", async () => {
    expect(await readCertificate("http://example.com")).toBeNull();
  });

  it("rechaza destinos bloqueados", async () => {
    delete process.env.TEMPO_ALLOW_PRIVATE_TARGETS;
    await expect(readCertificate("https://127.0.0.1")).rejects.toThrow(/privada o reservada/);
  });
});
