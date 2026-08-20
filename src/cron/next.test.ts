import { describe, it, expect } from "vitest";
import { parseExpression } from "./parser.js";
import { nextRun } from "./next.js";

function next(expr: string, from: Date): Date {
  return nextRun(parseExpression(expr), from);
}

describe("nextRun", () => {
  it("'* * * * *' devuelve el minuto siguiente exacto", () => {
    const from = new Date(2026, 0, 1, 10, 30, 45);
    expect(next("* * * * *", from)).toEqual(new Date(2026, 0, 1, 10, 31, 0));
  });

  it("'*/5 * * * *' cae en el próximo múltiplo de 5", () => {
    const from = new Date(2026, 0, 1, 10, 2, 0);
    expect(next("*/5 * * * *", from)).toEqual(new Date(2026, 0, 1, 10, 5, 0));
  });

  it("cuando 'from' ya está sobre un disparo, devuelve el siguiente", () => {
    const from = new Date(2026, 0, 1, 10, 0, 0);
    expect(next("0 * * * *", from)).toEqual(new Date(2026, 0, 1, 11, 0, 0));
  });

  it("'0 0 * * *' devuelve la próxima medianoche", () => {
    const from = new Date(2026, 0, 1, 10, 30, 0);
    expect(next("0 0 * * *", from)).toEqual(new Date(2026, 0, 2, 0, 0, 0));
  });

  it("'0 9 * * 1' devuelve el próximo lunes a las 09:00", () => {
    const from = new Date(2026, 0, 1, 0, 0, 0); // jueves 1 de enero
    expect(next("0 9 * * 1", from)).toEqual(new Date(2026, 0, 5, 9, 0, 0));
  });

  it("OR día-mes/día-semana: dispara por el día de la semana", () => {
    const from = new Date(2026, 0, 1, 0, 0, 0);
    // día 13 O viernes; el viernes 2 de enero llega antes que el 13
    expect(next("0 0 13 * 5", from)).toEqual(new Date(2026, 0, 2, 0, 0, 0));
  });

  it("OR día-mes/día-semana: dispara por el día del mes", () => {
    const from = new Date(2026, 0, 9, 12, 0, 0); // viernes 9 al mediodía
    // el 13 (martes) llega antes que el próximo viernes (16)
    expect(next("0 0 13 * 5", from)).toEqual(new Date(2026, 0, 13, 0, 0, 0));
  });

  it("cruza el fin de año", () => {
    const from = new Date(2026, 11, 31, 23, 59, 0);
    expect(next("* * * * *", from)).toEqual(new Date(2027, 0, 1, 0, 0, 0));
  });

  it("encuentra el 29 de febrero del próximo año bisiesto", () => {
    const from = new Date(2026, 5, 1, 0, 0, 0);
    expect(next("0 0 29 2 *", from)).toEqual(new Date(2028, 1, 29, 0, 0, 0));
  });

  it("una expresión que nunca dispara falla en vez de colgarse", () => {
    const from = new Date(2026, 0, 1, 0, 0, 0);
    expect(() => next("0 0 30 2 *", from)).toThrowError(/horizonte/);
  });
});
