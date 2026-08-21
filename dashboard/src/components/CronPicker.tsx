import { cronToText } from "../lib/format.js";

const PRESETS = [
  { label: "1 min", value: "* * * * *" },
  { label: "5 min", value: "*/5 * * * *" },
  { label: "15 min", value: "*/15 * * * *" },
  { label: "30 min", value: "*/30 * * * *" },
  { label: "1 hora", value: "0 * * * *" },
  { label: "1 día", value: "0 6 * * *" },
];

export function CronPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-medium text-dim">
        Cada cuánto chequear
      </label>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            aria-pressed={value === preset.value}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${
              value === preset.value
                ? "border-accent bg-accent/15 text-accent"
                : "border-line bg-raised text-dim hover:text-ink"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="* * * * *"
        aria-describedby={`${id}-text`}
        className="tabular rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink"
      />
      <p id={`${id}-text`} className="text-xs text-dim">
        {value.trim() === "" ? "Escribí una expresión cron de 5 campos" : cronToText(value)}
      </p>
    </div>
  );
}
