import { useEffect, useRef, useState } from "react";

export interface CheckEvent {
  type: "check";
  monitorId: number;
  name: string;
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number;
  error: string | null;
  at: string;
}

export interface IncidentEvent {
  type: "incident";
  change: "opened" | "resolved";
  monitorId: number;
  name: string;
  detail: string;
  at: string;
}

export type TempoEvent = CheckEvent | IncidentEvent;

// EventSource reconecta solo, pero avisamos el estado para que la UI no mienta
// mostrando datos viejos como si estuvieran al día
export function useEventStream(onEvent: (event: TempoEvent) => void): boolean {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("error", () => setConnected(false));

    const forward = (event: MessageEvent<string>) => {
      setConnected(true);
      try {
        handler.current(JSON.parse(event.data) as TempoEvent);
      } catch {
        // un frame roto no puede tumbar el stream
      }
    };

    source.addEventListener("check", forward as EventListener);
    source.addEventListener("incident", forward as EventListener);

    return () => source.close();
  }, []);

  return connected;
}
