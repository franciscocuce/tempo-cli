import type { RequestHandler } from "express";
import type { Database } from "better-sqlite3";
import { getSessionUser } from "../../store/sessions.js";
import { newToken, safeEqual } from "../../auth/tokens.js";
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, csrfCookie } from "../cookies.js";
import "../context.js";

const CSRF_TTL_MS = 12 * 3_600_000;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function attachUser(db: Database): RequestHandler {
  return (req, _res, next) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string" && token !== "") {
      req.user = getSessionUser(db, token);
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.user === undefined) {
    res.status(401).json({ error: "Necesitás iniciar sesión" });
    return;
  }
  next();
};

// el front no puede leer la cookie de sesión (es httpOnly) pero sí esta, y la copia al header.
// un sitio ajeno puede hacer que el navegador mande la cookie, pero no puede leerla para
// completar el header, así que la petición falsificada no pasa
export const ensureCsrfCookie: RequestHandler = (req, res, next) => {
  if (typeof req.cookies?.[CSRF_COOKIE] !== "string" || req.cookies[CSRF_COOKIE] === "") {
    res.cookie(CSRF_COOKIE, newToken(), csrfCookie(CSRF_TTL_MS));
  }
  next();
};

export const requireCsrf: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);

  if (typeof cookie !== "string" || typeof header !== "string" || !safeEqual(cookie, header)) {
    res.status(403).json({
      error: `Falta el token CSRF. Pedí primero un GET a /api/auth/me y repetí la cookie ${CSRF_COOKIE} en el header ${CSRF_HEADER}`,
    });
    return;
  }

  next();
};
