import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SALT = "tempo.secret.v1";

// scrypt tarda ~100ms, así que la clave derivada se cachea por proceso
let cached: { raw: string; key: Buffer } | null = null;

export function generateSecretKey(): string {
  return randomBytes(KEY_BYTES).toString("hex");
}

function key(): Buffer {
  const raw = process.env.TEMPO_SECRET_KEY;

  if (raw === undefined || raw.trim() === "") {
    throw new Error(
      "Falta TEMPO_SECRET_KEY. Generá una con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  if (cached === null || cached.raw !== raw) {
    cached = { raw, key: scryptSync(raw, SALT, KEY_BYTES) };
  }

  return cached.key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);

  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Secreto con formato inválido");
  }

  const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// deja ver de qué webhook se trata sin exponer el token que lo autoriza
export function maskUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "••••";
  }

  const segments = url.pathname.split("/").filter((s) => s !== "");
  if (segments.length === 0) {
    return `${url.origin}/••••`;
  }

  segments[segments.length - 1] = "••••";
  return `${url.origin}/${segments.join("/")}`;
}
