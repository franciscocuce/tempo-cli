import { useEffect, useState } from "react";
import { api, type PublicStatus } from "../lib/api.js";
import { UptimeBar } from "../components/UptimeBar.js";
import { StatusPill } from "../components/StatusPill.js";
import { dateTime, duration, latency, percent, relative } from "../lib/format.js";

const REFRESH_MS = 60_000;

function headline(status: PublicStatus): { text: string; tone: string } {
  if (status.monitors.length === 0) {
    return { text: "Sin servicios publicados", tone: "text-dim" };
  }

  const down = status.monitors.filter((monitor) => monitor.status === "down").length;

  if (down === 0) {
    return { text: "Todos los sistemas funcionando", tone: "text-up" };
  }
  return {
    text: down === 1 ? "Un servicio con problemas" : `${down} servicios con problemas`,
    tone: "text-down",
  };
}

export function Status() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = () =>
      api
        .publicStatus()
        .then((next) => {
          setStatus(next);
          setFailed(false);
        })
        .catch(() => setFailed(true));

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  if (failed && status === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-sm text-down">No se pudo cargar el estado.</p>
      </main>
    );
  }

  if (status === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-sm text-dim">Cargando…</p>
      </main>
    );
  }

  const summary = headline(status);

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
        <header className="mb-10">
          <p className="text-sm tracking-wide text-dim uppercase">Estado de los servicios</p>
          <h1 className={`mt-2 text-3xl font-semibold tracking-tight sm:text-4xl ${summary.tone}`}>
            {summary.text}
          </h1>
          <p className="mt-2 text-sm text-dim">
            Actualizado {relative(status.generatedAt)} · se refresca solo cada minuto
          </p>
        </header>

        <div className="flex flex-col gap-4">
          {status.monitors.map((monitor) => (
            <section key={monitor.name} className="rounded-xl border border-line bg-surface p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-medium text-ink">{monitor.name}</h2>
                <StatusPill status={monitor.status} />
              </div>

              <UptimeBar days={monitor.days} from={status.from} />

              <dl className="tabular mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-sm">
                <div>
                  <dt className="text-xs text-dim">últimas 24 h</dt>
                  <dd className="text-ink">{percent(monitor.uptime24h)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-dim">últimos 30 d</dt>
                  <dd className="text-ink">{percent(monitor.uptime30d)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-dim">latencia p95</dt>
                  <dd className="text-ink">{latency(monitor.p95)}</dd>
                </div>
              </dl>
            </section>
          ))}
        </div>

        {status.incidents.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-dim uppercase">
              Caídas recientes
            </h2>
            <ul className="flex flex-col gap-2">
              {status.incidents.map((incident, index) => (
                <li
                  key={index}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm"
                >
                  <span className="text-ink">{incident.monitorName}</span>
                  <span className="text-dim">{dateTime(incident.startedAt)}</span>
                  <span className="tabular text-dim">
                    {incident.resolvedAt === null ? "en curso" : duration(incident.durationMs ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-14 border-t border-line pt-5 text-center text-xs text-dim">
          Monitoreado con{" "}
          <a
            href="https://github.com/franciscocuce/tempo"
            className="text-accent hover:underline"
            rel="noreferrer noopener"
          >
            tempo
          </a>
        </footer>
      </main>
    </div>
  );
}
