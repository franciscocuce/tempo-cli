import { openDb } from "../db/connection.js";
import { listMonitors } from "../store/monitors.js";
import { startDaemon, AlreadyRunningError } from "../scheduler/daemon.js";

export function start(): void {
  const db = openDb();

  let daemon;
  try {
    daemon = startDaemon(db);
  } catch (err) {
    if (err instanceof AlreadyRunningError) {
      console.error(err.message);
      db.close();
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const active = listMonitors(db).filter((monitor) => monitor.enabled).length;
  console.log(`tempo vigilando ${active} monitor(es). Ctrl+C para parar.`);

  let stopping = false;
  const shutdown = async () => {
    if (stopping) {
      return;
    }
    stopping = true;

    console.log("\nEsperando a que terminen los chequeos en curso...");
    await daemon.stop();
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
