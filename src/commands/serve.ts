import { openDb } from "../db/connection.js";
import { createServer } from "../api/server.js";

interface ServeOptions {
  port: string;
}

export function serve(options: ServeOptions): void {
  const port = Number(options.port);
  if (!Number.isInteger(port) || port <= 0) {
    console.error(`"${options.port}" no es un puerto válido`);
    process.exitCode = 1;
    return;
  }

  const db = openDb();
  const server = createServer(db).listen(port, () => {
    console.log(`tempo web en http://localhost:${port}`);
    console.log("Ctrl+C para detener");
  });

  process.on("SIGINT", () => {
    console.log("\nDeteniendo servidor...");
    server.close();
    db.close();
    process.exit(0);
  });
}
