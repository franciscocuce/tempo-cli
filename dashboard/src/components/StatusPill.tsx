import type { MonitorStatus } from "../lib/api.js";

const STYLES: Record<MonitorStatus, { label: string; className: string }> = {
  up: { label: "en línea", className: "border-up/40 bg-up/10 text-up" },
  down: { label: "caído", className: "border-down/50 bg-down/10 text-down" },
  paused: { label: "pausado", className: "border-line bg-raised text-dim" },
  pending: { label: "sin datos", className: "border-line bg-raised text-dim" },
};

export function StatusPill({ status }: { status: MonitorStatus }) {
  const style = STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      <span
        className={`size-1.5 rounded-full bg-current ${status === "down" ? "pulse" : ""}`}
        aria-hidden
      />
      {style.label}
    </span>
  );
}
