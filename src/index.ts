import { Command } from "commander";
import { add } from "./commands/add.js";
import { list } from "./commands/list.js";
import { remove } from "./commands/remove.js";
import { toggle } from "./commands/toggle.js";
import { start } from "./commands/start.js";
import { run } from "./commands/run.js";
import { history } from "./commands/history.js";
import { serve } from "./commands/serve.js";

const program = new Command();

program
  .name("tempo")
  .description("Scheduler tipo cron hecho desde cero")
  .version("0.1.0");

program
  .command("add")
  .description("Agrega una tarea nueva")
  .requiredOption("--name <nombre>", "nombre único de la tarea")
  .requiredOption("--cron <expresión>", 'expresión cron de 5 campos, ej "*/5 * * * *"')
  .requiredOption("--type <tipo>", "shell o http")
  .option("--command <comando>", "comando a ejecutar (para type shell)")
  .option("--url <url>", "URL a llamar (para type http)")
  .action(add);

program
  .command("list")
  .description("Lista todas las tareas con su próximo disparo")
  .action(list);

program
  .command("remove <id>")
  .description("Elimina una tarea por id")
  .action(remove);

program
  .command("enable <id>")
  .description("Reactiva una tarea pausada")
  .action((id: string) => toggle(id, true));

program
  .command("disable <id>")
  .description("Pausa una tarea sin borrarla")
  .action((id: string) => toggle(id, false));

program
  .command("start")
  .description("Arranca el scheduler (tick cada minuto, Ctrl+C para parar)")
  .action(start);

program
  .command("run <id>")
  .description("Ejecuta una tarea ahora mismo, sin esperar al cron")
  .action(run);

program
  .command("history")
  .description("Muestra las últimas ejecuciones")
  .option("--task <id>", "filtrar por tarea")
  .option("--limit <n>", "cantidad máxima de filas", "20")
  .action(history);

program
  .command("serve")
  .description("Levanta la API REST + dashboard web")
  .option("--port <n>", "puerto donde escuchar", "3000")
  .action(serve);

program.parse();
