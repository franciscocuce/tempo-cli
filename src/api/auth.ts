import { Router, type RequestHandler } from "express";
import type { Database } from "better-sqlite3";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { newToken, safeEqual } from "../auth/tokens.js";
import { loginSchema, setupSchema, changePasswordSchema } from "../auth/schemas.js";
import {
  countUsers,
  createUser,
  getUserByEmail,
  setPassword,
  type User,
} from "../store/users.js";
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  pruneSessions,
  SESSION_TTL_MS,
} from "../store/sessions.js";
import { CSRF_COOKIE, SESSION_COOKIE, csrfCookie, sessionCookie } from "./cookies.js";
import { requireAuth } from "./middleware/auth.js";
import { issuesToMessage } from "../store/validate.js";
import "./context.js";

const CSRF_TTL_MS = 12 * 3_600_000;

export interface SetupToken {
  value: string | null;
}

// contra un hash de descarte cuando el email no existe, así responder "no existe" tarda
// lo mismo que responder "contraseña incorrecta" y no se puede enumerar usuarios por tiempo
let dummyHash: Promise<string> | null = null;

function decoyHash(): Promise<string> {
  dummyHash ??= hashPassword(newToken());
  return dummyHash;
}

function publicUser(user: User) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

function startSession(db: Database, userId: number, res: Parameters<RequestHandler>[1]): void {
  const token = newToken();
  createSession(db, userId, token);
  res.cookie(SESSION_COOKIE, token, sessionCookie(SESSION_TTL_MS));
  res.cookie(CSRF_COOKIE, newToken(), csrfCookie(CSRF_TTL_MS));
}

export function createAuthRouter(db: Database, setup: SetupToken): Router {
  const router = Router();

  router.get("/me", (req, res) => {
    if (req.user === undefined) {
      res.status(401).json({
        error: "No hay sesión",
        setupNeeded: countUsers(db) === 0 && setup.value !== null,
      });
      return;
    }
    res.json(publicUser(req.user));
  });

  router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: issuesToMessage(parsed.error) });
      return;
    }

    const user = getUserByEmail(db, parsed.data.email);
    const valid = await verifyPassword(
      user?.passwordHash ?? (await decoyHash()),
      parsed.data.password
    );

    if (user === undefined || !valid) {
      res.status(401).json({ error: "Email o contraseña incorrectos" });
      return;
    }

    pruneSessions(db);
    startSession(db, user.id, res);
    res.json(publicUser(user));
  });

  router.post("/logout", (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string" && token !== "") {
      deleteSession(db, token);
    }

    res.clearCookie(SESSION_COOKIE, sessionCookie(0));
    res.status(204).end();
  });

  // solo sirve una vez, en el primer arranque, con el token que se imprime en la consola
  router.post("/setup", async (req, res) => {
    if (setup.value === null || countUsers(db) > 0) {
      res.status(409).json({ error: "tempo ya tiene un usuario configurado" });
      return;
    }

    const parsed = setupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: issuesToMessage(parsed.error) });
      return;
    }

    if (!safeEqual(parsed.data.token, setup.value)) {
      res.status(403).json({ error: "El token de alta no coincide" });
      return;
    }

    const user = createUser(db, parsed.data.email, await hashPassword(parsed.data.password));
    setup.value = null;

    startSession(db, user.id, res);
    res.status(201).json(publicUser(user));
  });

  router.post("/password", requireAuth, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: issuesToMessage(parsed.error) });
      return;
    }

    const user = getUserByEmail(db, req.user!.email);
    if (user === undefined || !(await verifyPassword(user.passwordHash, parsed.data.current))) {
      res.status(403).json({ error: "La contraseña actual no coincide" });
      return;
    }

    setPassword(db, user.id, await hashPassword(parsed.data.next));

    // cambiar la contraseña cierra las demás sesiones y abre una nueva para esta pestaña
    deleteUserSessions(db, user.id);
    startSession(db, user.id, res);

    res.json({ ok: true });
  });

  return router;
}
