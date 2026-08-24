import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Monitor, type Overview as OverviewData } from "../lib/api.js";
import { StatTile } from "../components/StatTile.js";
import { StatusPill } from "../components/StatusPill.js";
import { UptimeBar } from "../components/UptimeBar.js";
import { Button, Empty, Spinner } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
import { MonitorForm } from "./MonitorForm.js";
import { cronToText, latency, percent, relative } from "../lib/format.js";
import { useToast } from "../lib/toast.js";

interface Row {
  monitor: Monitor;
  days: (number | null)[];
  from: string;
}

export function Overview({ reloadKey }: { reloadKey: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const [monitors, summary] = await Promise.all([api.monitors(), api.overview()]);
    setOverview(summary);

    const stats = await Promise.all(monitors.map((monitor) => api.stats(monitor.id)));
    setRows(
      monitors.map((monitor, index) => ({
        monitor,
        days: stats[index].history.map((day) => day.percent),
        from: stats[index].history[0]?.day ?? "",
      })),
    );
  }, []);

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, [load, reloadKey]);

  async function checkNow(monitor: Monitor) {
    try {
      const result = await api.checkNow(monitor.id);
      toast[result.ok ? "ok" : "error"](
        result.ok
          ? `${monitor.name} responde en ${result.latencyMs} ms`
          : `${monitor.name}: ${result.error ?? "falló"}`,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo chequear");
    }
  }

  if (rows === null) {
    return <Spinner label="Cargando monitores" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Sitios activos"
          value={overview?.active ?? "—"}
          detail={`${overview?.total ?? 0} en total`}
        />
        <StatTile
          label="Uptime 24 h"
          value={percent(overview?.uptime24h ?? null)}
          tone={(overview?.uptime24h ?? 100) >= 99 ? "up" : "warn"}
        />
        <StatTile
          label="Caídos ahora"
          value={overview?.down ?? 0}
          tone={(overview?.down ?? 0) > 0 ? "down" : "ink"}
        />
        <StatTile
          label="Incidentes abiertos"
          value={overview?.openIncidents ?? 0}
          tone={(overview?.openIncidents ?? 0) > 0 ? "down" : "ink"}
        />
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Monitores</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Nuevo monitor
        </Button>
      </div>

      {rows.length === 0 ? (
        <Empty title="Todavía no vigilás nada">
          Agregá tu primer sitio y tempo te avisa cuando se caiga.
        </Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map(({ monitor, days, from }) => (
            <article
              key={monitor.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/monitors/${monitor.id}`}
                    className="truncate font-medium text-ink hover:text-accent"
                  >
                    {monitor.name}
                  </Link>
                  <p className="truncate text-xs text-dim">{monitor.url}</p>
                </div>
                <StatusPill status={monitor.status} />
              </div>

              <UptimeBar days={days} from={from} />

              <dl className="tabular grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
                <div>
                  <dt className="text-dim">uptime 24 h</dt>
                  <dd className="text-ink">{percent(monitor.uptime24h)}</dd>
                </div>
                <div>
                  <dt className="text-dim">latencia</dt>
                  <dd className="text-ink">{latency(monitor.lastLatencyMs)}</dd>
                </div>
                <div>
                  <dt className="text-dim">último</dt>
                  <dd className="text-ink">{relative(monitor.lastCheckedAt)}</dd>
                </div>
              </dl>

              {monitor.lastError !== null && monitor.status === "down" && (
                <p className="truncate rounded-md border border-down/30 bg-down/10 px-2 py-1 text-xs text-down">
                  {monitor.lastError}
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-dim">{cronToText(monitor.cron)}</span>
                <div className="flex gap-1.5">
                  <Button onClick={() => void checkNow(monitor)}>Chequear</Button>
                  <Link
                    to={`/monitors/${monitor.id}`}
                    className="inline-flex items-center rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-ink hover:bg-line"
                  >
                    Detalle
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal title="Nuevo monitor" open={creating} onClose={() => setCreating(false)}>
        <MonitorForm
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      </Modal>
    </div>
  );
}
