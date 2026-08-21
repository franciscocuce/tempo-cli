import type { CookieOptions } from "express";

export const SESSION_COOKIE = "tempo_session";
export const CSRF_COOKIE = "tempo_csrf";
export const CSRF_HEADER = "x-tempo-csrf";

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
