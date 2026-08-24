import type { Check } from "../lib/api.js";

const WIDTH = 600;
const HEIGHT = 140;
const PAD = 8;

export function LatencyChart({ checks }: { checks: Check[] }) {
  // vienen del más nuevo al más viejo y el gráfico avanza hacia la derecha
  const points = [...checks].reverse();

  if (points.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-dim">
        Hacen falta al menos dos chequeos para dibujar la latencia.
      </p>
    );
  }

  const values = points.map((check) => check.latencyMs);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const x = (index: number) => PAD + (index / (points.length - 1)) * (WIDTH - PAD * 2);
  const y = (value: number) => HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2);

  const line = points.map((check, index) => `${x(index)},${y(check.latencyMs)}`).join(" ");
  const area = `${PAD},${HEIGHT - PAD} ${line} ${WIDTH - PAD},${HEIGHT - PAD}`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-36 w-full"
        role="img"
        aria-label={`Latencia de los últimos ${points.length} chequeos, entre ${min} y ${max} milisegundos`}
      >
        <polygon points={area} fill="var(--t-accent)" opacity={0.12} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--t-accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((check, index) =>
          check.ok ? null : (
            <circle
              key={check.id}
              cx={x(index)}
              cy={y(check.latencyMs)}
              r={3}
              fill="var(--t-down)"
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${new Date(check.checkedAt).toLocaleString()} · ${check.error ?? "falló"}`}</title>
            </circle>
          ),
        )}
      </svg>
      <div className="tabular flex justify-between text-[11px] text-dim">
        <span>mín {min} ms</span>
        <span>máx {max} ms</span>
      </div>
    </div>
  );
}
