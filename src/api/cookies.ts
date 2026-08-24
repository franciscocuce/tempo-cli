import type { CookieOptions, Request } from "express";

export const SESSION_COOKIE = "tempo_session";
export const CSRF_COOKIE = "tempo_csrf";
export const CSRF_HEADER = "x-tempo-csrf";

// cookie-parser tipa req.cookies como any, así que todo lo que salga de ahí entra al
// programa sin verificar. Este es el único lugar que lo toca, y devuelve string o nada
export function readCookie(req: Request, name: string): string | undefined {
  const jar: unknown = req.cookies;
  if (typeof jar !== "object" || jar === null) {
    return undefined;
  }

  const value = (jar as Record<string, unknown>)[name];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function useSecureCookies(): boolean {
  return process.env.TEMPO_SECURE_COOKIES === "1" || process.env.NODE_ENV === "production";
}

export function sessionCookie(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
    maxAge: maxAgeMs,
  };
}

// esta sí tiene que poder leerla el navegador: el front la copia al header X-Tempo-CSRF
export function csrfCookie(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: false,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
    maxAge: maxAgeMs,
  };
}
