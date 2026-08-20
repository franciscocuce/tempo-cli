import { openDb } from "../db/connection.js";
import { runMaintenance } from "../store/retention.js";

export function maintenance(): void {
  const db = openDb();
  try {
    const report = runMaintenance(db);
    console.log(`Días resumidos: ${report.rolledDays}`);
    console.log(`Chequeos crudos borrados: ${report.prunedChecks}`);
    console.log(`Resúmenes viejos borrados: ${report.prunedDays}`);
    db.exec("VACUUM");
    console.log("Base compactada");
  } finally {
    db.close();
  }
}
