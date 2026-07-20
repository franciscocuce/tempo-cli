import type { Run } from "./api.js";

function oneLine(output: string): string {
  const flat = output.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? flat.slice(0, 80) + "…" : flat;
}

export function RunsHistory({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return <p className="empty">Todavía no se ejecutó ninguna tarea.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>tarea</th>
          <th>cuándo</th>
          <th>duración</th>
          <th>estado</th>
          <th>salida</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id}>
            <td>{run.taskName}</td>
            <td>{new Date(run.startedAt).toLocaleString()}</td>
            <td>{run.durationMs}ms</td>
            <td className={run.status === "ok" ? "ok" : "error"}>{run.status}</td>
            <td><code>{oneLine(run.output)}</code></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
