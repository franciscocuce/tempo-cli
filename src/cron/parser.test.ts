import { describe, it, expect } from "vitest";
import { parseExpression } from "./parser.js";

describe("parseExpression", () => {
  it("expande '*' al rango completo del campo", () => {
    const schedule = parseExpression("* * * * *");
    expect(schedule.minute.values).toHaveLength(60);
    expect(schedule.minute.values[0]).toBe(0);
    expect(schedule.minute.values[59]).toBe(59);
    expect(schedule.hour.values).toHaveLength(24);
    expect(schedule.month.values).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("marca '*' como no restringido y un valor suelto como restringido", () => {
    const schedule = parseExpression("5 * * * *");
    expect(schedule.minute.values).toEqual([5]);
    expect(schedule.minute.restricted).toBe(true);
    expect(schedule.hour.restricted).toBe(false);
  });

  it("parsea una lista de valores", () => {
    const schedule = parseExpression("1,15,30 * * * *");
    expect(schedule.minute.values).toEqual([1, 15, 30]);
  });

  it("parsea un rango", () => {
    const schedule = parseExpression("* 1-5 * * *");
    expect(schedule.hour.values).toEqual([1, 2, 3, 4, 5]);
  });

  it("parsea un paso sobre '*'", () => {
    const schedule = parseExpression("*/10 * * * *");
    expect(schedule.minute.values).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("parsea un paso sobre un rango", () => {
    const schedule = parseExpression("0-30/5 * * * *");
    expect(schedule.minute.values).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });

  it("ordena y elimina duplicados", () => {
    const schedule = parseExpression("30,5,5,15 * * * *");
    expect(schedule.minute.values).toEqual([5, 15, 30]);
  });

  it("normaliza el día de la semana 7 a 0 (domingo)", () => {
    const schedule = parseExpression("* * * * 7");
    expect(schedule.dayOfWeek.values).toEqual([0]);
  });

  it("lanza si no hay exactamente 5 campos", () => {
    expect(() => parseExpression("* * * *")).toThrow();
    expect(() => parseExpression("* * * * * *")).toThrow();
    expect(() => parseExpression("")).toThrow();
  });

  it("lanza si un valor está fuera de rango", () => {
    expect(() => parseExpression("60 * * * *")).toThrow();
    expect(() => parseExpression("* 24 * * *")).toThrow();
    expect(() => parseExpression("* * 0 * *")).toThrow();
    expect(() => parseExpression("* * * * 8")).toThrow();
  });

  it("lanza ante tokens basura", () => {
    expect(() => parseExpression("abc * * * *")).toThrow();
    expect(() => parseExpression("*/0 * * * *")).toThrow();
    expect(() => parseExpression("5-1 * * * *")).toThrow();
  });
});
