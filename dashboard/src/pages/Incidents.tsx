import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Incident } from "../lib/api.js";
import { Empty, Spinner } from "../components/ui.js";
import { dateTime, duration, relative } from "../lib/format.js";

export function Incidents({ reloadKey }: { reloadKey: number }) {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);

  useEffect(() => {
    api
      .incidents({ limit: 100 })
      .then(setIncidents)
      .catch(() => setIncidents([]));
  }, [reloadKey]);

  if (incidents === null) {
    return <Spinner label="Cargando incidentes" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Incidentes</h1>

      {incidents.length === 0 ? (
        <Empty title="Ninguna caída registrada">
          Cuando un sitio falle las veces seguidas que configuraste, aparece acá.
        </Empty>
      ) : (
        <ol className="relative flex flex-col gap-0 border-l border-line pl-6">
          {incidents.map((incident) => {
            const open = incident.resolvedAt === null;

            return (
              <li key={incident.id} className="relative pb-6 last:pb-0">
                <span
                  className={`absolute top-1.5 -left-[1.72rem] size-2.5 rounded-full ring-4 ring-bg ${
                    open ? "bg-down pulse" : "bg-up"
                  }`}
                  aria-hidden
                />

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    to={`/monitors/${incident.monitorId}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {incident.monitorName}
                  </Link>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      open ? "border-down/40 bg-down/10 text-down" : "border-line bg-raised text-dim"
                    }`}
                  >
                    {open ? "en curso" : "resuelto"}
                  </span>
                  <span className="tabular text-xs text-dim">
                    {open
                      ? duration(Date.now() - new Date(incident.startedAt).getTime())
                      : duration(incident.durationMs ?? 0)}
                  </span>
                </div>

                <p className="mt-1 text-sm text-dim">{incident.cause}</p>

                <p className="tabular mt-1 text-xs text-dim">
                  {dateTime(incident.startedAt)} · {relative(incident.startedAt)} ·{" "}
                  {incident.failedChecks} chequeo(s) fallido(s)
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
