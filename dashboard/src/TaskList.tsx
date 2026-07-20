import { deleteTask, runTask, setEnabled, type Task } from "./api.js";

function formatNext(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export function TaskList({ tasks, onChange }: { tasks: Task[]; onChange: () => void }) {
  async function act(fn: () => Promise<unknown>) {
    await fn();
    onChange();
  }

  if (tasks.length === 0) {
    return <p className="empty">No hay tareas todavía.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>id</th>
          <th>nombre</th>
          <th>cron</th>
          <th>tipo</th>
          <th>estado</th>
          <th>próximo</th>
          <th>acciones</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id} className={task.enabled ? "" : "paused"}>
            <td>{task.id}</td>
            <td>{task.name}</td>
            <td><code>{task.cron}</code></td>
            <td>{task.type}</td>
            <td>{task.enabled ? "activa" : "pausada"}</td>
            <td>{formatNext(task.nextRun)}</td>
            <td className="actions">
              <button onClick={() => act(() => runTask(task.id))}>run</button>
              <button onClick={() => act(() => setEnabled(task.id, !task.enabled))}>
                {task.enabled ? "pausar" : "activar"}
              </button>
              <button className="danger" onClick={() => act(() => deleteTask(task.id))}>
                borrar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
