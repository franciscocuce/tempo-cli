import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

// el token de sesión son 256 bits al azar, así que no hay nada que adivinar por fuerza bruta:
// alcanza con sha256 para que leer la base no equivalga a poder usar las sesiones
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
