const BAR = 3;
const GAP = 1;
const HEIGHT = 34;

function fill(percent: number | null): string {
  if (percent === null) {
    return "var(--t-idle)";
  }
  if (percent === 100) {
    return "var(--t-up)";
  }
  if (percent === 0) {
    return "var(--t-down)";
  }
  return percent >= 99 ? "var(--t-warn)" : "var(--t-down)";
}

function dayLabel(from: string, index: number): string {
  const date = new Date(`${from}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}

function readable(percent: number | null): string {
  return percent === null ? "sin datos" : `${percent}% disponible`;
}

export function UptimeBar({
  days,
  from,
  className = "",
}: {
  days: (number | null)[];
  from: string;
  className?: string;
}) {
  const width = Math.max(days.length * (BAR + GAP) - GAP, 1);
  const withData = days.filter((day) => day !== null).length;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-[34px] w-full"
        role="img"
        aria-label={`Disponibilidad de los últimos ${days.length} días, con datos en ${withData}`}
      >
        {days.map((percent, index) => (
          <rect
            key={index}
            x={index * (BAR + GAP)}
            y={0}
            width={BAR}
            height={HEIGHT}
            rx={1}
            fill={fill(percent)}
            opacity={percent === null ? 0.5 : 1}
          >
            <title>{`${dayLabel(from, index)} · ${readable(percent)}`}</title>
          </rect>
        ))}
      </svg>
      <div className="mt-1.5 flex justify-between text-[11px] text-dim">
        <span>hace {days.length} días</span>
        <span>hoy</span>
      </div>
    </div>
  );
}
