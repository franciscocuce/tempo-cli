import { createInterface } from "node:readline/promises";
import { existsSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { defaultDbPath, openDb } from "../db/connection.js";
import { currentVersion, LATEST_VERSION } from "../db/migrations/index.js";
import { lockHolder, STALE_MS } from "../scheduler/lock.js";

// los archivos que SQLite deja al lado de la base en modo WAL. Al restaurar hay que
// sacarlos: si quedara un -wal de la base vieja, SQLite lo aplicaría sobre la nueva
const SIDECARS = ["-wal", "-shm"];

export async function backup(dest: string): Promise<void> {
  const target = resolveTarget(dest);

  const db = openDb();
  try {
    // .backup() de better-sqlite3 usa la API de backup online de SQLite: copia páginas
    // tomando el lock que corresponde. Un `cp` mientras el daemon escribe puede dejar
    // el archivo a medias, y encima se pierde lo que todavía vive en el -wal
    await db.backup(target);
    console.log(`Copia guardada en ${target} (${size(target)})`);
  } catch (err) {
    console.error(`No se pudo hacer la copia: ${message(err)}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

export async function restore(source: string, options: { yes?: boolean } = {}): Promise<void> {
  if (!existsSync(source)) {
    console.error(`No existe el archivo ${source}`);
    process.exitCode = 1;
    return;
  }

  const version = readVersion(source);
  if (version === null) {
    process.exitCode = 1;
    return;
  }

  if (version > LATEST_VERSION) {
    console.error(
      `La copia es de una versión más nueva de tempo (esquema ${version}, este binario llega a ${LATEST_VERSION}).\n` +
        "Actualizá tempo antes de restaurarla.",
    );
    process.exitCode = 1;
    return;
  }

  const target = defaultDbPath();

  if (existsSync(target) && !(await confirmOverwrite(target, options.yes === true))) {
    console.log("No se restauró nada");
    return;
  }

  if (existsSync(target) && schedulerRunning(target)) {
    console.error(
      "Hay un scheduler corriendo sobre esta base. Paralo (Ctrl+C en `tempo start` o `tempo serve`) y volvé a intentar.",
    );
    process.exitCode = 1;
    return;
  }

  try {
    if (existsSync(target)) {
      renameSync(target, `${target}.bak`);
      for (const suffix of SIDECARS) {
        rmSync(`${target}${suffix}`, { force: true });
      }
      console.log(`La base anterior quedó en ${target}.bak`);
    }

    // se restaura con .backup() y no copiando el archivo: así el resultado sale
    // consolidado en un solo archivo, sin arrastrar el -wal de la copia
    const from = new Database(source, { readonly: true });
    try {
      await from.backup(target);
    } finally {
      from.close();
    }

    // abrirla aplica las migraciones que le falten, por si la copia es más vieja
    const db = openDb(target);
    const applied = currentVersion(db);
    db.close();

    console.log(`Restaurada desde ${source} (esquema ${version} → ${applied})`);
  } catch (err) {
    console.error(`No se pudo restaurar: ${message(err)}`);
    process.exitCode = 1;
  }
}

// si le pasás una carpeta, arma adentro un nombre con la fecha
function resolveTarget(dest: string): string {
  if (existsSync(dest) && statSync(dest).isDirectory()) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return path.join(dest, `tempo-${stamp}.db`);
  }
  return dest;
}

function readVersion(source: string): number | null {
  let db: Database.Database;
  try {
    db = new Database(source, { readonly: true, fileMustExist: true });
  } catch (err) {
    console.error(`${source} no se puede abrir como base de datos: ${message(err)}`);
    return null;
  }

  try {
    // SQLite abre el archivo sin leerlo; recién una consulta real delata que no es una base
    db.prepare("SELECT count(*) FROM sqlite_master").get();
    return currentVersion(db);
  } catch (err) {
    console.error(`${source} no parece una base de tempo: ${message(err)}`);
    return null;
  } finally {
    db.close();
  }
}

function schedulerRunning(target: string): boolean {
  try {
    const db = new Database(target, { readonly: true, fileMustExist: true });
    try {
      const holder = lockHolder(db);
      if (holder === null) {
        return false;
      }
      return Date.now() - new Date(holder.heartbeatAt).getTime() < STALE_MS;
    } finally {
      db.close();
    }
  } catch {
    // sin tabla de lock (base vieja o vacía) no hay nada corriendo
    return false;
  }
}

async function confirmOverwrite(target: string, skip: boolean): Promise<boolean> {
  if (skip) {
    return true;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `Esto reemplaza ${target} (queda una copia en ${target}.bak). ¿Seguir? [s/N] `,
    );
    return answer.trim().toLowerCase() === "s";
  } finally {
    rl.close();
  }
}

function size(file: string): string {
  const bytes = statSync(file).size;
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
