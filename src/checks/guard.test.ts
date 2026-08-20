import { describe, it, expect, afterEach } from "vitest";
import { assertAllowedTarget, parseTargetUrl, isBlockedAddress } from "./guard.js";

describe("parseTargetUrl", () => {
  it("acepta http y https", () => {
    expect(parseTargetUrl("https://example.com").protocol).toBe("https:");
    expect(parseTargetUrl("http://example.com").protocol).toBe("http:");
  });

  it("rechaza file://", () => {
    expect(() => parseTargetUrl("file:///etc/passwd")).toThrowError(/http y https/);
  });

  it("rechaza texto que no es una URL", () => {
    expect(() => parseTargetUrl("example.com")).toThrowError(/no es una URL válida/);
  });
});

describe("isBlockedAddress", () => {
  it("bloquea loopback", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("127.10.20.30")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
  });

  it("bloquea la metadata de las nubes", () => {
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
  });

  it("bloquea redes privadas", () => {
    expect(isBlockedAddress("10.0.0.5")).toBe(true);
    expect(isBlockedAddress("172.16.0.1")).toBe(true);
    expect(isBlockedAddress("172.31.255.255")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
    expect(isBlockedAddress("100.64.0.1")).toBe(true);
  });

  it("bloquea multicast, reservados y broadcast", () => {
    expect(isBlockedAddress("224.0.0.1")).toBe(true);
    expect(isBlockedAddress("240.0.0.1")).toBe(true);
    expect(isBlockedAddress("255.255.255.255")).toBe(true);
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
  });

  it("bloquea link-local y unique-local de IPv6", () => {
    expect(isBlockedAddress("fe80::1")).toBe(true);
    expect(isBlockedAddress("fc00::1")).toBe(true);
    expect(isBlockedAddress("fd12:3456::1")).toBe(true);
    expect(isBlockedAddress("ff02::1")).toBe(true);
  });

  it("bloquea IPv4 disfrazada de IPv6", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
  });

  it("deja pasar direcciones públicas", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("172.32.0.1")).toBe(false);
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("bloquea cualquier cosa que no sea una IP", () => {
    expect(isBlockedAddress("no-soy-una-ip")).toBe(true);
  });
});

describe("assertAllowedTarget", () => {
  afterEach(() => {
    delete process.env.TEMPO_ALLOW_PRIVATE_TARGETS;
  });

  it("rechaza una IP privada escrita directo en la URL", async () => {
    await expect(assertAllowedTarget("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      /privada o reservada/
    );
  });

  it("rechaza localhost", async () => {
    await expect(assertAllowedTarget("http://127.0.0.1:3000/api")).rejects.toThrow(
      /privada o reservada/
    );
  });

  it("deja pasar lo privado cuando se activa a propósito", async () => {
    process.env.TEMPO_ALLOW_PRIVATE_TARGETS = "1";
    const url = await assertAllowedTarget("http://127.0.0.1:3000/api");
    expect(url.hostname).toBe("127.0.0.1");
  });

  it("sigue rechazando esquemas raros aunque se permita lo privado", async () => {
    process.env.TEMPO_ALLOW_PRIVATE_TARGETS = "1";
    await expect(assertAllowedTarget("file:///etc/passwd")).rejects.toThrow(/http y https/);
  });

  it("avisa cuando el dominio no resuelve", async () => {
    await expect(
      assertAllowedTarget("https://este-dominio-no-existe-tempo.invalid")
    ).rejects.toThrow(/No se pudo resolver/);
  });
});
