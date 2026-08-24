import type { Database } from "better-sqlite3";
import type { Migration } from "./types.js";
import { initial } from "./001-initial.js";
import { monitors } from "./002-monitors.js";
import { users } from "./003-users.js";

const MIGRATIONS: Migration[] = [initial, monitors, users];

// hasta qué versión sabe migrar este binario. Sirve para rechazar una base que viene
// de una versión más nueva de tempo, que tendría tablas que este código no conoce
export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function currentVersion(db: Database): number {
  return db.pragma("user_version", { simple: true }) as number;
}

export function migrate(db: Database): number {
  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion(db)) {
      continue;
    }

    db.transaction(() => {
      migration.up(db);
      // user_version no acepta parámetros, va interpolado; el número sale de acá, no del usuario
      db.pragma(`user_version = ${migration.version}`);
    })();
  }

  return currentVersion(db);
}

export type { Migration } from "./types.js";
