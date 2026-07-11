import { z } from "zod";
import { parseExpression } from "../cron/index.js";

export const newTaskSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre no puede estar vacío"),
    cron: z.string().superRefine((expr, ctx) => {
      try {
        parseExpression(expr);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : "Expresión cron inválida",
        });
      }
    }),
    type: z.enum(["shell", "http"], {
      errorMap: () => ({ message: 'El tipo debe ser "shell" o "http"' }),
    }),
    payload: z.string().trim().min(1, "Falta el comando o la URL"),
  })
  .superRefine((task, ctx) => {
    if (task.type === "http" && !z.string().url().safeParse(task.payload).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: `"${task.payload}" no es una URL válida`,
      });
    }
  });

export type ValidatedNewTask = z.infer<typeof newTaskSchema>;
