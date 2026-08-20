import { describe, it, expect } from "vitest";
import { statusMatches, isValidStatusSpec } from "./status.js";

describe("statusMatches", () => {
  it("compara un código exacto", () => {
    expect(statusMatches("200", 200)).toBe(true);
    expect(statusMatches("200", 201)).toBe(false);
  });

  it("compara una familia entera", () => {
    expect(statusMatches("2xx", 204)).toBe(true);
    expect(statusMatches("2xx", 301)).toBe(false);
    expect(statusMatches("4xx", 404)).toBe(true);
  });

  it("compara un rango", () => {
    expect(statusMatches("200-204", 202)).toBe(true);
    expect(statusMatches("200-204", 205)).toBe(false);
  });

  it("acepta una lista", () => {
    expect(statusMatches("200, 301", 301)).toBe(true);
    expect(statusMatches("200, 301", 302)).toBe(false);
  });
});

describe("isValidStatusSpec", () => {
  it("acepta las formas válidas", () => {
    for (const spec of ["200", "2xx", "200-299", "200,301", "2xx, 3xx"]) {
      expect(isValidStatusSpec(spec)).toBe(true);
    }
  });

  it("rechaza las inválidas", () => {
    for (const spec of ["", "20", "6xx", "abc", "300-200", "200-"]) {
      expect(isValidStatusSpec(spec)).toBe(false);
    }
  });
});
