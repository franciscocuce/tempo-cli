import { openDb } from "../db/connection.js";
import { createServer } from "../api/server.js";
import { startDaemon, AlreadyRunningError, type Daemon } from "../scheduler/daemon.js";
import { createEventBus } from "../events/bus.js";
import { countUsers } from "../store/users.js";
import { newToken } from "../auth/tokens.js";

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
  const bus = createEventBus();

  // nunca hay una contraseña por defecto: el primer usuario se crea con este token,
  // que vive en memoria y muere con el proceso
  const setupToken = countUsers(db) === 0 ? newToken() : null;

  let daemon: Daemon | null = null;
  if (options.scheduler !== false) {
    try {
      daemon = startDaemon(db, { bus });
    } catch (err) {
      if (!(err instanceof AlreadyRunningError)) {
        throw err;
      }
      console.warn(`${err.message}\nSe levanta solo la web, sin chequear.`);
    }
  }

  const app = createServer(db, {
    setupToken,
    bus,
    trustProxy: parseTrustProxy(process.env.TEMPO_TRUST_PROXY),
  });

  const server = app.listen(port, host, () => {
    const shown = host === "0.0.0.0" ? "localhost" : host;
    console.log(`tempo web en http://${shown}:${port}`);

    if (setupToken !== null) {
      console.log("");
      console.log("Todavía no hay ningún usuario. Entrá y creá el primero con este token:");
      console.log(`  ${setupToken}`);
      console.log("(vale una sola vez y se pierde si reiniciás el proceso)");
      console.log("");
    }

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

function parseTrustProxy(raw: string | undefined): boolean | number | string | undefined {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  const hops = Number(raw);
  return Number.isInteger(hops) ? hops : raw;
}
