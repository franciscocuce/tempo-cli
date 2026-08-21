import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { createUser, removeUser, countUsers, normalizeEmail } from "./users.js";
import {
  createSession,
  getSessionUser,
  deleteSession,
  deleteUserSessions,
  pruneSessions,
} from "./sessions.js";
import { newToken, hashToken } from "../auth/tokens.js";

const NOW = new Date("2026-08-20T12:00:00.000Z");

describe("usuarios", () => {
  let db: Database;

  beforeEach(() => {
    db = openDb(":memory:");
  });

  it("normaliza el email al guardarlo", () => {
    const user = createUser(db, "  Francisco@Example.COM ", "hash");
    expect(user.email).toBe("francisco@example.com");
  });

  it("normalizeEmail deja todo en minúscula y sin espacios", () => {
    expect(normalizeEmail("  A@B.com ")).toBe("a@b.com");
  });

  it("no deja repetir emails", () => {
    createUser(db, "a@b.com", "hash");
    expect(() => createUser(db, "A@B.com", "hash")).toThrowError(/UNIQUE/);
  });

  it("cuenta los usuarios", () => {
    expect(countUsers(db)).toBe(0);
    createUser(db, "a@b.com", "hash");
    expect(countUsers(db)).toBe(1);
  });
});

describe("sesiones", () => {
  let db: Database;
  let userId: number;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "francisco@example.com", "hash").id;
  });

  it("una sesión válida devuelve el usuario", () => {
    const token = newToken();
    createSession(db, userId, token, NOW);

    expect(getSessionUser(db, token, NOW)?.email).toBe("francisco@example.com");
  });

  it("guarda el hash del token, no el token", () => {
    const token = newToken();
    createSession(db, userId, token, NOW);

    const row = db.prepare("SELECT id FROM sessions").get() as { id: string };
    expect(row.id).toBe(hashToken(token));
    expect(row.id).not.toBe(token);
  });

  it("un token inventado no devuelve nada", () => {
    createSession(db, userId, newToken(), NOW);
    expect(getSessionUser(db, "token-falso", NOW)).toBeUndefined();
  });

  it("una sesión vencida no devuelve nada", () => {
    const token = newToken();
    createSession(db, userId, token, NOW, 1000);

    const despues = new Date(NOW.getTime() + 2000);
    expect(getSessionUser(db, token, despues)).toBeUndefined();
  });

  it("deleteSession la invalida", () => {
    const token = newToken();
    createSession(db, userId, token, NOW);

    expect(deleteSession(db, token)).toBe(true);
    expect(getSessionUser(db, token, NOW)).toBeUndefined();
  });

  it("deleteUserSessions cierra todas las del usuario", () => {
    const a = newToken();
    const b = newToken();
    createSession(db, userId, a, NOW);
    createSession(db, userId, b, NOW);

    expect(deleteUserSessions(db, userId)).toBe(2);
    expect(getSessionUser(db, a, NOW)).toBeUndefined();
    expect(getSessionUser(db, b, NOW)).toBeUndefined();
  });

  it("prune limpia solo las vencidas", () => {
    const viva = newToken();
    const vencida = newToken();
    createSession(db, userId, viva, NOW);
    createSession(db, userId, vencida, NOW, 1000);

    const despues = new Date(NOW.getTime() + 2000);
    expect(pruneSessions(db, despues)).toBe(1);
    expect(getSessionUser(db, viva, despues)?.id).toBe(userId);
  });

  it("borrar el usuario se lleva sus sesiones", () => {
    const token = newToken();
    createSession(db, userId, token, NOW);

    removeUser(db, userId);
    expect(getSessionUser(db, token, NOW)).toBeUndefined();
  });
});
