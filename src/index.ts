import { Command } from "commander";
import { add } from "./commands/add.js";
import { list } from "./commands/list.js";
import { remove } from "./commands/remove.js";
import { toggle } from "./commands/toggle.js";

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

program.parse();
