import { hash, verify, Algorithm } from "@node-rs/argon2";

export const MIN_PASSWORD_LENGTH = 10;

// los parámetros que recomienda OWASP para argon2id
const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain, OPTIONS);
  } catch {
    // un hash guardado con otro formato no tiene que tirar abajo el login
    return false;
  }
}
