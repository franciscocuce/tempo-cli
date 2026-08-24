import { hostname } from "node:os";
import type { Database } from "better-sqlite3";

// si el proceso que tenía el lock se murió sin soltarlo, a los 3 minutos sin latir
// se lo considera muerto y otro puede tomarlo
export const STALE_MS = 3 * 60_000;
const HEARTBEAT_MS = 30_000;

export interface LockHolder {
  pid: number;
  host: string;
  heartbeatAt: string;
}

export interface Lock {
  release: () => void;
}

interface LockRow {
  pid: number;
  host: string;
  heartbeat_at: string;
}

export function lockHolder(db: Database): LockHolder | null {
  const row = db.prepare("SELECT * FROM scheduler_lock WHERE id = 1").get() as LockRow | undefined;
  if (row === undefined) {
    return null;
  }
  return { pid: row.pid, host: row.host, heartbeatAt: row.heartbeat_at };
}

export function acquireLock(db: Database, now: Date = new Date()): Lock | null {
  const holder = lockHolder(db);

  if (holder !== null) {
    const age = now.getTime() - new Date(holder.heartbeatAt).getTime();
    const mine = holder.pid === process.pid && holder.host === hostname();
    if (age < STALE_MS && !mine) {
      return null;
    }
  }

  db.prepare(
    `INSERT INTO scheduler_lock (id, pid, host, heartbeat_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET pid = excluded.pid, host = excluded.host,
                                    heartbeat_at = excluded.heartbeat_at`,
  ).run(process.pid, hostname(), now.toISOString());

  const beat = setInterval(() => {
    try {
      db.prepare("UPDATE scheduler_lock SET heartbeat_at = ? WHERE id = 1").run(
        new Date().toISOString(),
      );
    } catch {
      // la base se cerró antes que el intervalo, no hay nada que hacer
    }
  }, HEARTBEAT_MS);

  beat.unref();

  return {
    release: () => {
      clearInterval(beat);
      try {
        db.prepare("DELETE FROM scheduler_lock WHERE id = 1 AND pid = ?").run(process.pid);
      } catch {
        // ídem
      }
    },
  };
}
