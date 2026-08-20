import { z } from "zod";
import { parseExpression } from "../cron/index.js";
import { isValidStatusSpec } from "../checks/status.js";
import { parseTargetUrl } from "../checks/guard.js";
import { DEFAULT_EXPECTED_STATUS, DEFAULT_METHOD, DEFAULT_TIMEOUT_MS } from "../checks/types.js";

const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const monitorFields = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre no puede estar vacío")
    .max(80, "El nombre no puede pasar de 80 caracteres"),

  url: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      try {
        parseTargetUrl(value);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : "URL inválida",
        });
      }
    }),

  method: z
    .enum(["GET", "HEAD", "POST"], {
      errorMap: () => ({ message: "El método debe ser GET, HEAD o POST" }),
    })
    .default(DEFAULT_METHOD as "GET"),

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

  expectedStatus: z
    .string()
    .trim()
    .default(DEFAULT_EXPECTED_STATUS)
    .refine(isValidStatusSpec, {
      message: 'Estado esperado inválido. Se admite "200", "2xx", "200-299" o una lista',
    }),

  keyword: z.preprocess(
    emptyToNull,
    z.string().trim().max(200, "La palabra clave no puede pasar de 200 caracteres").nullable()
  ),

  keywordMode: z
    .enum(["contains", "absent"], {
      errorMap: () => ({ message: 'El modo debe ser "contains" o "absent"' }),
    })
    .default("contains"),

  timeoutMs: z.coerce
    .number()
    .int()
    .min(MIN_TIMEOUT_MS, `El timeout mínimo es ${MIN_TIMEOUT_MS / 1000}s`)
    .max(MAX_TIMEOUT_MS, `El timeout máximo es ${MAX_TIMEOUT_MS / 1000}s`)
    .default(DEFAULT_TIMEOUT_MS),

  followRedirects: z.boolean().default(true),

  confirmThreshold: z.coerce
    .number()
    .int()
    .min(1, "Hace falta al menos 1 fallo para declarar una caída")
    .max(10, "Más de 10 fallos seguidos es demasiado para avisar")
    .default(2),

  isPublic: z.boolean().default(true),
});

function noKeywordOnHead(
  monitor: { method?: string; keyword?: string | null },
  ctx: z.RefinementCtx
): void {
  if (monitor.keyword != null && monitor.method === "HEAD") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["keyword"],
      message: "Una respuesta HEAD no trae cuerpo: usá GET para buscar texto",
    });
  }
}

export const newMonitorSchema = monitorFields.superRefine(noKeywordOnHead);

export const patchMonitorSchema = monitorFields
  .extend({ enabled: z.boolean() })
  .partial()
  .superRefine(noKeywordOnHead);

export const newChannelSchema = z.object({
  type: z.enum(["discord"], { errorMap: () => ({ message: 'Por ahora solo hay canales "discord"' }) }),
  label: z.string().trim().min(1, "Ponele un nombre al canal").max(60),
  target: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      try {
        parseTargetUrl(value);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : "URL inválida",
        });
      }
    }),
});

export type ValidatedNewMonitor = z.infer<typeof newMonitorSchema>;
export type ValidatedMonitorPatch = z.infer<typeof patchMonitorSchema>;
export type ValidatedNewChannel = z.infer<typeof newChannelSchema>;

export function issuesToMessage(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(", ");
}
