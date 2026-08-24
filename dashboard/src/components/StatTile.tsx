import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  detail,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "ink" | "up" | "down" | "warn";
}) {
  const color =
    tone === "up"
      ? "text-up"
      : tone === "down"
        ? "text-down"
        : tone === "warn"
          ? "text-warn"
          : "text-ink";

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-dim uppercase">{label}</p>
      <p className={`tabular mt-1 text-2xl leading-none font-semibold ${color}`}>{value}</p>
      {detail !== undefined && <p className="mt-1.5 text-xs text-dim">{detail}</p>}
    </div>
  );
}
