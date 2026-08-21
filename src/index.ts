import { Command } from "commander";
import { add } from "./commands/add.js";
import { list } from "./commands/list.js";
import { edit } from "./commands/edit.js";
import { remove } from "./commands/remove.js";
import { toggle } from "./commands/toggle.js";
import { check } from "./commands/check.js";
import { history } from "./commands/history.js";
import { incidents } from "./commands/incidents.js";
import { channelAdd, channelList, channelRemove, channelTest } from "./commands/channel.js";
import { userAdd, userList, userPassword, userRemove } from "./commands/user.js";
import { start } from "./commands/start.js";
import { serve } from "./commands/serve.js";
import { maintenance } from "./commands/maintenance.js";

const program = new Command();

program
  .name("tempo")
  .description("Monitor de uptime self-hosted, con motor cron propio")
  .version("0.2.0");

program
  .command("add")
  .description("Agrega un monitor")
  .requiredOption("--name <nombre>", "nombre único del monitor")
  .requiredOption("--url <url>", "URL a vigilar")
  .requiredOption("--cron <expresión>", 'cada cuánto chequear, ej "*/5 * * * *"')
  .option("--method <método>", "GET, HEAD o POST", "GET")
  .option("--expect <estado>", 'estado esperado: "200", "2xx", "200-299" o una lista', "2xx")
  .option("--keyword <texto>", "texto que tiene que aparecer en la respuesta")
  .option("--keyword-mode <modo>", "contains o absent", "contains")
  .option("--timeout <ms>", "cuánto esperar la respuesta", "10000")
  .option("--no-redirects", "no seguir redirecciones")
  .option("--confirm <n>", "fallos seguidos antes de declararlo caído", "2")
  .option("--private", "no mostrarlo en el status page público")
  .action(add);

program
  .command("list")
  .description("Lista los monitores con su estado y uptime")
  .action(list);

program
  .command("edit <id>")
  .description("Cambia la configuración de un monitor")
  .option("--name <nombre>", "nuevo nombre")
  .option("--url <url>", "nueva URL")
  .option("--cron <expresión>", "nueva frecuencia")
  .option("--method <método>", "GET, HEAD o POST")
  .option("--expect <estado>", "nuevo estado esperado")
  .option("--keyword <texto>", "texto a buscar (vacío para sacarlo)")
  .option("--keyword-mode <modo>", "contains o absent")
  .option("--timeout <ms>", "nuevo timeout")
  .option("--confirm <n>", "fallos seguidos antes de declararlo caído")
  .option("--redirects", "seguir redirecciones")
  .option("--no-redirects", "no seguir redirecciones")
  .option("--public", "mostrarlo en el status page")
  .option("--no-public", "ocultarlo del status page")
  .action(edit);

program.command("remove <id>").description("Elimina un monitor y su historial").action(remove);

program
  .command("enable <id>")
  .description("Reactiva un monitor pausado")
  .action((id: string) => toggle(id, true));

program
  .command("disable <id>")
  .description("Pausa un monitor sin borrarlo")
  .action((id: string) => toggle(id, false));

program
  .command("check <id>")
  .description("Chequea un monitor ahora mismo")
  .action((id: string) => void check(id));

program
  .command("history")
  .description("Muestra los últimos chequeos")
  .option("--monitor <id>", "filtrar por monitor")
  .option("--limit <n>", "cantidad máxima de filas", "20")
  .action(history);

program
  .command("incidents")
  .description("Muestra las caídas registradas")
  .option("--monitor <id>", "filtrar por monitor")
  .option("--limit <n>", "cantidad máxima de filas", "20")
  .option("--open", "solo los incidentes abiertos")
  .action(incidents);

const channel = program.command("channel").description("Canales de notificación");

channel
  .command("add")
  .description("Agrega un canal de avisos")
  .option("--type <tipo>", "por ahora solo discord", "discord")
  .requiredOption("--label <nombre>", "cómo llamarlo")
  .requiredOption("--url <webhook>", "URL del webhook")
  .action(channelAdd);

channel.command("list").description("Lista los canales").action(channelList);
channel.command("rm <id>").description("Elimina un canal").action(channelRemove);
channel
  .command("test <id>")
  .description("Manda un aviso de prueba")
  .action((id: string) => void channelTest(id));

const user = program.command("user").description("Usuarios del dashboard");

user
  .command("add")
  .description("Crea un usuario (pide la contraseña por consola)")
  .requiredOption("--email <email>", "email para iniciar sesión")
  .option("--password <contraseña>", "pasarla por acá la deja en el historial del shell")
  .action((options) => void userAdd(options));

user.command("list").description("Lista los usuarios").action(userList);
user
  .command("password <email>")
  .description("Cambia la contraseña y cierra las sesiones abiertas")
  .action((email: string) => void userPassword(email));
user.command("rm <id>").description("Elimina un usuario").action(userRemove);

program
  .command("start")
  .description("Arranca el scheduler (Ctrl+C para parar)")
  .action(start);

program
  .command("serve")
  .description("Levanta la API REST, el dashboard y el scheduler")
  .option("--port <n>", "puerto donde escuchar", "3000")
  .option("--host <host>", "interfaz donde escuchar", "127.0.0.1")
  .option("--no-scheduler", "levantar solo la web, sin chequear")
  .action(serve);

program
  .command("maintenance")
  .description("Resume los días cerrados, borra lo viejo y compacta la base")
  .action(maintenance);

program.parse();
