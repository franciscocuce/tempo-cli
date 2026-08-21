export type TempoEvent =
  | {
      type: "check";
      monitorId: number;
      name: string;
      ok: boolean;
      httpStatus: number | null;
      latencyMs: number;
      error: string | null;
      at: string;
    }
  | {
      type: "incident";
      change: "opened" | "resolved";
      monitorId: number;
      name: string;
      detail: string;
      at: string;
    };

export interface EventBus {
  publish: (event: TempoEvent) => void;
  subscribe: (listener: (event: TempoEvent) => void) => () => void;
}

export function createEventBus(): EventBus {
  const listeners = new Set<(event: TempoEvent) => void>();

  return {
    publish: (event) => {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // un cliente que se desconectó a mitad no puede frenar a los demás
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
