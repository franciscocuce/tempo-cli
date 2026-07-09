import { Command } from "commander";

const program = new Command();

program
  .name("tempo")
  .description("Scheduler tipo cron hecho desde cero")
  .version("0.1.0");

program.parse();
