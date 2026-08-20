import { openDb } from "../db/connection.js";
import { createServer } from "../api/server.js";
import { startDaemon, AlreadyRunningError, type Daemon } from "../scheduler/daemon.js";

const DEFAULT_HOST = "127.0.0.1";

interface ServeOptions {
  port: string;
  host?: string;
  scheduler?: boolean;
}

export function serve(options: ServeOptions): void {
  const port = Number(options.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`"${options.port}" no es un puerto válido`);
    process.exitCode = 1;
    return;
  }

  // por defecto solo escucha en la máquina local; exponerlo a la red tiene que ser una decisión
  const host = options.host ?? process.env.TEMPO_HOST ?? DEFAULT_HOST;

  const db = openDb();

  let daemon: Daemon | null = null;
  if (options.scheduler !== false) {
    try {
      daemon = startDaemon(db);
    } catch (err) {
      if (!(err instanceof AlreadyRunningError)) {
        throw err;
      }
      console.warn(`${err.message}\nSe levanta solo la web, sin chequear.`);
    }
  }

  const server = createServer(db).listen(port, host, () => {
    console.log(`tempo web en http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
    if (daemon !== null) {
      console.log("El scheduler corre dentro de este mismo proceso");
    }
    console.log("Ctrl+C para detener");
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) {
      return;
    }
    stopping = true;

    console.log("\nDeteniendo...");
    server.close();
    await daemon?.stop();
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
