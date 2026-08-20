import type { Database } from "better-sqlite3";
import { encrypt, decrypt, maskUrl } from "../crypto/secret.js";
import type { Channel, ChannelType } from "../notify/types.js";

export interface NewChannel {
  type: ChannelType;
  label: string;
  target: string;
}

// lo que sale por la API: el target va enmascarado, nunca el webhook completo
export interface ChannelView {
  id: number;
  type: ChannelType;
  label: string;
  target: string;
  enabled: boolean;
  readable: boolean;
  createdAt: string;
}

interface ChannelRow {
  id: number;
  type: ChannelType;
  label: string;
  target: string;
  enabled: number;
  created_at: string;
}

function decryptTarget(row: ChannelRow): string | null {
  try {
    return decrypt(row.target);
  } catch {
    return null;
  }
}

export function addChannel(db: Database, input: NewChannel): ChannelView {
  const result = db
    .prepare(
      `INSERT INTO channels (type, label, target, enabled, created_at)
       VALUES (?, ?, ?, 1, ?)`
    )
    .run(input.type, input.label, encrypt(input.target), new Date().toISOString());

  return getChannelView(db, Number(result.lastInsertRowid))!;
}

function rows(db: Database): ChannelRow[] {
  return db.prepare("SELECT * FROM channels ORDER BY id").all() as ChannelRow[];
}

function toView(row: ChannelRow): ChannelView {
  const target = decryptTarget(row);

  return {
    id: row.id,
    type: row.type,
    label: row.label,
    target: target === null ? "••••" : maskUrl(target),
    enabled: row.enabled === 1,
    readable: target !== null,
    createdAt: row.created_at,
  };
}

export function listChannelViews(db: Database): ChannelView[] {
  return rows(db).map(toView);
}

export function getChannelView(db: Database, id: number): ChannelView | undefined {
  const row = db.prepare("SELECT * FROM channels WHERE id = ?").get(id) as ChannelRow | undefined;
  return row ? toView(row) : undefined;
}

// para uso interno del notificador: acá sí viaja el webhook descifrado.
// si la clave cambió y algún canal no se puede leer, se saltea en vez de tumbar el aviso
export function listChannels(db: Database): Channel[] {
  const channels: Channel[] = [];

  for (const row of rows(db)) {
    const target = decryptTarget(row);
    if (target === null) {
      continue;
    }
    channels.push({
      id: row.id,
      type: row.type,
      label: row.label,
      target,
      enabled: row.enabled === 1,
    });
  }

  return channels;
}

export function getChannel(db: Database, id: number): Channel | undefined {
  return listChannels(db).find((channel) => channel.id === id);
}

export function removeChannel(db: Database, id: number): boolean {
  return db.prepare("DELETE FROM channels WHERE id = ?").run(id).changes > 0;
}

export function setChannelEnabled(db: Database, id: number, enabled: boolean): boolean {
  return (
    db.prepare("UPDATE channels SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id).changes > 0
  );
}
