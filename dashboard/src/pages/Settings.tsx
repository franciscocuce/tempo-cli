import { useEffect, useState, type FormEvent } from "react";
import { api, type Channel } from "../lib/api.js";
import { Button, Card, Empty, Field, Spinner } from "../components/ui.js";
import { useToast } from "../lib/toast.js";
import { useAuth } from "../lib/auth.js";
import { dateTime } from "../lib/format.js";

function Channels() {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () =>
    api
      .channels()
      .then(setChannels)
      .catch(() => setChannels([]));

  useEffect(() => {
    void load();
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createChannel(label, target);
      setLabel("");
      setTarget("");
      toast.ok("Canal agregado");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar");
    } finally {
      setBusy(false);
    }
  }

  async function test(channel: Channel) {
    try {
      await api.testChannel(channel.id);
      toast.ok(`Aviso de prueba enviado por "${channel.label}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar");
    }
  }

  if (channels === null) {
    return <Spinner label="Cargando canales" />;
  }

  return (
    <Card title="Avisos por Discord">
      <p className="mb-4 text-sm text-dim">
        La URL del webhook se guarda cifrada y nunca vuelve entera desde la API: acá siempre la vas
        a ver enmascarada.
      </p>

      {channels.length === 0 ? (
        <Empty title="Sin canales configurados">
          Creá un webhook en tu servidor de Discord y pegá la URL acá abajo.
        </Empty>
      ) : (
        <ul className="mb-5 flex flex-col gap-2">
          {channels.map((channel) => (
            <li
              key={channel.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-raised px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{channel.label}</p>
                <p className="truncate text-xs text-dim">{channel.target}</p>
                {!channel.readable && (
                  <p className="text-xs text-warn">
                    No se puede descifrar. ¿Cambió TEMPO_SECRET_KEY?
                  </p>
                )}
              </div>

              <div className="flex gap-1.5">
                <Button onClick={() => void test(channel)} disabled={!channel.readable}>
                  Probar
                </Button>
                <Button
                  onClick={async () => {
                    await api.toggleChannel(channel.id, !channel.enabled);
                    await load();
                  }}
                >
                  {channel.enabled ? "Pausar" : "Activar"}
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    await api.deleteChannel(channel.id);
                    toast.ok("Canal eliminado");
                    await load();
                  }}
                >
                  Borrar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-col gap-3 border-t border-line pt-4">
        <Field
          label="Nombre del canal"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="mi servidor"
          required
        />
        <Field
          label="URL del webhook"
          type="url"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          required
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Guardando…" : "Agregar canal"}
        </Button>
      </form>
    </Card>
  );
}

function Password() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      toast.ok("Contraseña cambiada. Se cerraron las otras sesiones.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Contraseña">
      <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
        <Field
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          required
        />
        <Field
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          hint="Mínimo 10 caracteres. Cambiarla cierra las demás sesiones."
          required
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Cambiando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </Card>
  );
}

export function Settings() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Ajustes</h1>

      <Card title="Cuenta">
        <dl className="text-sm">
          <div className="flex justify-between border-b border-line pb-2">
            <dt className="text-dim">Email</dt>
            <dd className="text-ink">{user?.email}</dd>
          </div>
          <div className="flex justify-between pt-2">
            <dt className="text-dim">Miembro desde</dt>
            <dd className="text-ink">{dateTime(user?.createdAt ?? null)}</dd>
          </div>
        </dl>
      </Card>

      <Channels />
      <Password />
    </div>
  );
}
