import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 border-transparent",
  ghost: "bg-raised text-ink hover:bg-line border-line",
  danger: "bg-transparent text-down hover:bg-down/10 border-down/40",
};

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {(title !== undefined || actions !== undefined) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold tracking-wide text-dim uppercase">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

// el label real es lo que faltaba antes: con solo placeholder, un lector de pantalla
// no sabe qué se pide en cada campo
export function Field({
  label,
  hint,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-dim">
        {label}
      </label>
      <input
        {...props}
        id={id}
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
        className="rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-dim/60"
      />
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-xs text-dim">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-dim">
        {label}
      </label>
      <select
        {...props}
        id={id}
        className="rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink"
      >
        {children}
      </select>
    </div>
  );
}

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <input {...props} id={id} type="checkbox" className="size-4 accent-[var(--t-accent)]" />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
    </div>
  );
}

export function Spinner({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-dim" role="status">
      <span className="size-2 rounded-full bg-accent pulse" aria-hidden />
      {label}…
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children !== undefined && <div className="mt-1 text-sm text-dim">{children}</div>}
    </div>
  );
}
