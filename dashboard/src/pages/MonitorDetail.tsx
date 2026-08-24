import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Check, type Incident, type Monitor, type MonitorStats } from "../lib/api.js";
import { StatTile } from "../components/StatTile.js";
import { StatusPill } from "../components/StatusPill.js";
import { UptimeBar } from "../components/UptimeBar.js";
import { LatencyChart } from "../components/LatencyChart.js";
import { Button, Card, Empty, Spinner } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
import { MonitorForm } from "./MonitorForm.js";
import {
  certText,
  cronToText,
  dateTime,
  duration,
  latency,
  percent,
  relative,
} from "../lib/format.js";
import { useToast } from "../lib/toast.js";
import { useNow } from "../lib/now.js";

export function MonitorDetail({ reloadKey }: { reloadKey: number }) {
  const { id } = useParams();
  const monitorId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();

  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [editing, setEditing] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [found, stat, recent, related] = await Promise.all([
        api.monitor(monitorId),
        api.stats(monitorId),
        api.checks(monitorId, 60),
        api.incidents({ monitor: monitorId, limit: 10 }),
      ]);
      setMonitor(found);
      setStats(stat);
      setChecks(recent);
      setIncidents(related);
    } catch {
      setMissing(true);
    }
  }, [monitorId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (missing) {
    return (
      <Empty title="Ese monitor no existe">
        <Link to="/" className="text-accent hover:underline">
          Volver a la lista
        </Link>
      </Empty>
    );
  }

  if (monitor === null || stats === null) {
    return <Spinner label="Cargando monitor" />;
  }

  const cert = certText(monitor.certExpiresAt);

  async function checkNow() {
    const result = await api.checkNow(monitorId);
    toast[result.ok ? "ok" : "error"](
      result.ok ? `Responde en ${result.latencyMs} ms` : (result.error ?? "Falló el chequeo"),
    );
    await load();
  }

  async function togglePause() {
    await api.updateMonitor(monitorId, { enabled: !monitor!.enabled });
    toast.ok(monitor!.enabled ? "Monitor pausado" : "Monitor activado");
    await load();
  }

  async function remove() {
    await api.deleteMonitor(monitorId);
    toast.ok("Monitor eliminado");
    await navigate("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/" className="text-xs text-dim hover:text-ink">
            ← monitores
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{monitor.name}</h1>
            <StatusPill status={monitor.status} />
          </div>
          <a
            href={monitor.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-dim hover:text-accent"
          >
            {monitor.url}
          </a>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button onClick={() => void checkNow()}>Chequear ahora</Button>
          <Button onClick={() => setEditing(true)}>Editar</Button>
          <Button onClick={() => void togglePause()}>
            {monitor.enabled ? "Pausar" : "Activar"}
          </Button>
          <Button variant="danger" onClick={() => void remove()}>
            Borrar
          </Button>
        </div>
      </div>

      {monitor.status === "down" && monitor.openIncidentSince !== null && (
        <div
          role="alert"
          className="rounded-lg border border-down/40 bg-down/10 px-4 py-3 text-sm text-down"
        >
          Caído desde hace {duration(now - new Date(monitor.openIncidentSince).getTime())}.{" "}
          {monitor.lastError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Uptime 24 h" value={percent(stats.uptime24h.percent)} />
        <StatTile label="Uptime 30 d" value={percent(stats.uptime30d.percent)} />
        <StatTile label="Latencia p50" value={latency(stats.p50)} />
        <StatTile
          label="Certificado"
          value={cert.text}
          tone={cert.level === "ok" ? "ink" : cert.level}
        />
      </div>

      <Card title="Disponibilidad · 90 días">
        <UptimeBar days={stats.history.map((day) => day.percent)} from={stats.history[0].day} />
      </Card>

      <Card title="Latencia · últimos chequeos">
        <LatencyChart checks={checks} />
      </Card>

      <Card title="Configuración">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {[
            ["Frecuencia", cronToText(monitor.cron)],
            ["Próximo chequeo", relative(monitor.nextRun)],
            ["Método", monitor.method],
            ["Estado esperado", monitor.expectedStatus],
            [
              "Palabra clave",
              monitor.keyword === null
                ? "—"
                : `${monitor.keyword} (${monitor.keywordMode === "contains" ? "presente" : "ausente"})`,
            ],
            ["Timeout", `${monitor.timeoutMs / 1000} s`],
            ["Fallos antes de avisar", String(monitor.confirmThreshold)],
            ["En el status público", monitor.isPublic ? "sí" : "no"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-line pb-2">
              <dt className="text-dim">{label}</dt>
              <dd className="text-right text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Incidentes de este monitor">
        {incidents.length === 0 ? (
          <p className="text-sm text-dim">Nunca se cayó. </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 text-sm last:border-0"
              >
                <span className="text-ink">{dateTime(incident.startedAt)}</span>
                <span className="tabular text-dim">
                  {incident.durationMs === null ? "en curso" : duration(incident.durationMs)}
                </span>
                <span className="w-full truncate text-xs text-dim">{incident.cause}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Últimos chequeos">
        {checks.length === 0 ? (
          <p className="text-sm text-dim">Todavía no se chequeó.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-dim">
                  <th className="pb-2 font-medium">cuándo</th>
                  <th className="pb-2 font-medium">estado</th>
                  <th className="pb-2 font-medium">http</th>
                  <th className="pb-2 font-medium">latencia</th>
                  <th className="pb-2 font-medium">detalle</th>
                </tr>
              </thead>
              <tbody>
                {checks.slice(0, 25).map((check) => (
                  <tr key={check.id} className="border-t border-line">
                    <td className="py-1.5 whitespace-nowrap text-dim">
                      {relative(check.checkedAt)}
                    </td>
                    <td className={check.ok ? "text-up" : "text-down"}>
                      {check.ok ? "ok" : "falló"}
                    </td>
                    <td className="tabular text-dim">{check.httpStatus ?? "—"}</td>
                    <td className="tabular text-dim">{check.latencyMs} ms</td>
                    <td className="max-w-xs truncate text-dim">{check.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal title="Editar monitor" open={editing} onClose={() => setEditing(false)}>
        <MonitorForm
          monitor={monitor}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      </Modal>
    </div>
  );
}
