import { useState, type FormEvent } from "react";
import { api, type Monitor } from "../lib/api.js";
import { Button, Checkbox, Field, SelectField } from "../components/ui.js";
import { CronPicker } from "../components/CronPicker.js";
import { useToast } from "../lib/toast.js";

interface Draft {
  name: string;
  url: string;
  cron: string;
  method: string;
  expectedStatus: string;
  keyword: string;
  keywordMode: string;
  timeoutMs: string;
  confirmThreshold: string;
  followRedirects: boolean;
  isPublic: boolean;
}

function toDraft(monitor?: Monitor): Draft {
  return {
    name: monitor?.name ?? "",
    url: monitor?.url ?? "",
    cron: monitor?.cron ?? "*/5 * * * *",
    method: monitor?.method ?? "GET",
    expectedStatus: monitor?.expectedStatus ?? "2xx",
    keyword: monitor?.keyword ?? "",
    keywordMode: monitor?.keywordMode ?? "contains",
    timeoutMs: String(monitor?.timeoutMs ?? 10000),
    confirmThreshold: String(monitor?.confirmThreshold ?? 2),
    followRedirects: monitor?.followRedirects ?? true,
    isPublic: monitor?.isPublic ?? true,
  };
}

export function MonitorForm({
  monitor,
  onSaved,
}: {
  monitor?: Monitor;
  onSaved: (monitor: Monitor) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(monitor));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const payload = {
      name: draft.name,
      url: draft.url,
      cron: draft.cron,
      method: draft.method,
      expectedStatus: draft.expectedStatus,
      keyword: draft.keyword.trim() === "" ? null : draft.keyword,
      keywordMode: draft.keywordMode,
      timeoutMs: Number(draft.timeoutMs),
      confirmThreshold: Number(draft.confirmThreshold),
      followRedirects: draft.followRedirects,
      isPublic: draft.isPublic,
    };

    try {
      const saved =
        monitor === undefined
          ? await api.createMonitor(payload)
          : await api.updateMonitor(monitor.id, payload);

      toast.ok(monitor === undefined ? "Monitor creado" : "Monitor actualizado");
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field
        label="Nombre"
        value={draft.name}
        onChange={(event) => set("name", event.target.value)}
        placeholder="portfolio"
        required
      />

      <Field
        label="URL"
        type="url"
        value={draft.url}
        onChange={(event) => set("url", event.target.value)}
        placeholder="https://franciscocuce.dev"
        required
      />

      <CronPicker id="cron" value={draft.cron} onChange={(value) => set("cron", value)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Método"
          value={draft.method}
          onChange={(event) => set("method", event.target.value)}
        >
          <option value="GET">GET</option>
          <option value="HEAD">HEAD</option>
          <option value="POST">POST</option>
        </SelectField>

        <Field
          label="Estado esperado"
          value={draft.expectedStatus}
          onChange={(event) => set("expectedStatus", event.target.value)}
          hint='"200", "2xx" o "200-299"'
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Palabra clave (opcional)"
          value={draft.keyword}
          onChange={(event) => set("keyword", event.target.value)}
          placeholder="Francisco"
          hint="Detecta la página que responde 200 pero muestra un error"
        />

        <SelectField
          label="La palabra tiene que"
          value={draft.keywordMode}
          onChange={(event) => set("keywordMode", event.target.value)}
        >
          <option value="contains">estar presente</option>
          <option value="absent">estar ausente</option>
        </SelectField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Timeout (ms)"
          type="number"
          min={1000}
          max={60000}
          step={500}
          value={draft.timeoutMs}
          onChange={(event) => set("timeoutMs", event.target.value)}
        />

        <Field
          label="Fallos antes de avisar"
          type="number"
          min={1}
          max={10}
          value={draft.confirmThreshold}
          onChange={(event) => set("confirmThreshold", event.target.value)}
          hint="Evita alertar por un hipo de red"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Checkbox
          label="Seguir redirecciones"
          checked={draft.followRedirects}
          onChange={(event) => set("followRedirects", event.target.checked)}
        />
        <Checkbox
          label="Mostrar en el status page público"
          checked={draft.isPublic}
          onChange={(event) => set("isPublic", event.target.checked)}
        />
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-down">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Guardando…" : monitor === undefined ? "Crear monitor" : "Guardar cambios"}
      </Button>
    </form>
  );
}
