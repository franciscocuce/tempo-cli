import { useCallback, useEffect, useState } from "react";
import { getRuns, getTasks, type Run, type Task } from "./api.js";
import { TaskForm } from "./TaskForm.js";
import { TaskList } from "./TaskList.js";
import { RunsHistory } from "./RunsHistory.js";

const POLL_MS = 5000;

export function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  const refresh = useCallback(() => {
    getTasks().then(setTasks).catch(() => {});
    getRuns().then(setRuns).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <main>
      <header>
        <h1>tempo</h1>
        <p>scheduler tipo cron — dashboard</p>
      </header>

      <TaskForm onCreated={refresh} />

      <section className="card">
        <h2>Tareas</h2>
        <TaskList tasks={tasks} onChange={refresh} />
      </section>

      <section className="card">
        <h2>Historial</h2>
        <RunsHistory runs={runs} />
      </section>
    </main>
  );
}
