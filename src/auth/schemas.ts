import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "./password.js";

const password = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
  )
  .max(200, "La contraseña es demasiado larga");

const email = z.string().trim().email("Eso no parece un email");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Falta la contraseña").max(200),
});

export const setupSchema = z.object({
  token: z.string().min(1, "Falta el token de alta"),
  email,
  password,
});

export const changePasswordSchema = z.object({
  current: z.string().min(1, "Falta la contraseña actual"),
  next: password,
});

export const newUserSchema = z.object({ email, password });
