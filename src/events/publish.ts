import type { EventBus } from "./bus.js";
import type { Monitor } from "../store/monitors.js";
import type { Transition } from "../incidents/state.js";

export function publishTransition(
  bus: EventBus,
  monitor: Monitor,
  transition: Transition,
  at: Date = new Date(),
): void {
  const isoAt = at.toISOString();

  bus.publish({
    type: "check",
    monitorId: monitor.id,
    name: monitor.name,
    ok: transition.outcome.ok,
    httpStatus: transition.outcome.httpStatus,
    latencyMs: transition.outcome.latencyMs,
    error: transition.outcome.error,
    at: isoAt,
  });

  if (transition.opened || transition.resolved) {
    bus.publish({
      type: "incident",
      change: transition.opened ? "opened" : "resolved",
      monitorId: monitor.id,
      name: monitor.name,
      detail: transition.alert?.detail ?? "",
      at: isoAt,
    });
  }
}
