import { describe, it, expect, vi } from "vitest";
import { createEventBus, type TempoEvent } from "./bus.js";

const event: TempoEvent = {
  type: "check",
  monitorId: 1,
  name: "portfolio",
  ok: true,
  httpStatus: 200,
  latencyMs: 120,
  error: null,
  at: "2026-08-20T12:00:00.000Z",
};

describe("bus de eventos", () => {
  it("le llega a todos los suscriptos", () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();

    bus.subscribe(a);
    bus.subscribe(b);
    bus.publish(event);

    expect(a).toHaveBeenCalledWith(event);
    expect(b).toHaveBeenCalledWith(event);
  });

  it("desuscribirse corta el envío", () => {
    const bus = createEventBus();
    const listener = vi.fn();

    const unsubscribe = bus.subscribe(listener);
    unsubscribe();
    bus.publish(event);

    expect(listener).not.toHaveBeenCalled();
  });

  it("un suscriptor que explota no frena a los demás", () => {
    const bus = createEventBus();
    const sano = vi.fn();

    bus.subscribe(() => {
      throw new Error("se cortó la conexión");
    });
    bus.subscribe(sano);

    expect(() => bus.publish(event)).not.toThrow();
    expect(sano).toHaveBeenCalledOnce();
  });

  it("publicar sin nadie escuchando no rompe", () => {
    expect(() => createEventBus().publish(event)).not.toThrow();
  });
});
