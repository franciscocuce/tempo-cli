import { useState } from "react";
import { createTask, type TaskType } from "./api.js";

export function TaskForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [cron, setCron] = useState("");
  const [type, setType] = useState<TaskType>("shell");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createTask({
        name,
        cron,
        type,
        command: type === "shell" ? target : undefined,
        url: type === "http" ? target : undefined,
      });
      setName("");
      setCron("");
      setTarget("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la tarea");
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Nueva tarea</h2>
      <div className="fields">
        <input placeholder="nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="* * * * *" value={cron} onChange={(e) => setCron(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
          <option value="shell">shell</option>
          <option value="http">http</option>
        </select>
        <input
          placeholder={type === "shell" ? "comando" : "https://..."}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <button type="submit">Agregar</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
