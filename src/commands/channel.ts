import { openDb } from "../db/connection.js";
import { addChannel, getChannel, listChannelViews, removeChannel } from "../store/channels.js";
import { newChannelSchema, issuesToMessage } from "../store/validate.js";
import { send } from "../notify/index.js";
import { parseId } from "./parse-id.js";

interface ChannelAddOptions {
  type?: string;
  label: string;
  url: string;
}

export function channelAdd(options: ChannelAddOptions): void {
  const parsed = newChannelSchema.safeParse({
    type: options.type ?? "discord",
    label: options.label,
    target: options.url,
  });

  if (!parsed.success) {
    console.error(issuesToMessage(parsed.error));
    process.exitCode = 1;
    return;
  }

  const db = openDb();
  try {
    const channel = addChannel(db, parsed.data);
    console.log(`Canal "${channel.label}" creado con id ${channel.id}`);
    console.log(`Destino guardado cifrado: ${channel.target}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

export function channelList(): void {
  const db = openDb();
  try {
    const channels = listChannelViews(db);

    if (channels.length === 0) {
      console.log("No hay canales. Agregá uno con: tempo channel add --label ... --url ...");
      return;
    }

    console.table(
      channels.map((channel) => ({
        id: channel.id,
        tipo: channel.type,
        nombre: channel.label,
        destino: channel.target,
        estado: channel.enabled ? "activo" : "pausado",
        legible: channel.readable ? "sí" : "no (¿cambió TEMPO_SECRET_KEY?)",
      })),
    );
  } finally {
    db.close();
  }
}

export function channelRemove(rawId: string): void {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const db = openDb();
  try {
    if (removeChannel(db, id)) {
      console.log(`Canal ${id} eliminado`);
      return;
    }
    console.error(`No existe un canal con id ${id}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

export async function channelTest(rawId: string): Promise<void> {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const db = openDb();
  try {
    const channel = getChannel(db, id);
    if (channel === undefined) {
      console.error(`No existe un canal con id ${id} (o no se pudo descifrar su destino)`);
      process.exitCode = 1;
      return;
    }

    await send(channel, {
      kind: "up",
      monitorName: "prueba",
      url: "https://example.com",
      detail: "Si estás leyendo esto en Discord, el canal quedó bien configurado",
      at: new Date(),
    });

    console.log(`Aviso de prueba enviado por "${channel.label}"`);
  } catch (err) {
    console.error(`No se pudo enviar: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
