import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDb } from "../db/connection.js";
import {
  addChannel,
  listChannels,
  listChannelViews,
  getChannel,
  removeChannel,
  setChannelEnabled,
} from "./channels.js";

const WEBHOOK = "https://discord.com/api/webhooks/123456789/tokenSuperSecreto";

describe("store de canales", () => {
  let db: Database;

  beforeEach(() => {
    process.env.TEMPO_SECRET_KEY = "clave-de-prueba";
    db = openDb(":memory:");
  });

  afterEach(() => {
    delete process.env.TEMPO_SECRET_KEY;
  });

  it("guarda el destino cifrado, no en texto plano", () => {
    addChannel(db, { type: "discord", label: "mi server", target: WEBHOOK });

    const raw = db.prepare("SELECT target FROM channels WHERE id = 1").get() as { target: string };
    expect(raw.target).not.toContain("tokenSuperSecreto");
    expect(raw.target.split(".")).toHaveLength(3);
  });

  it("la vista para la API devuelve el destino enmascarado", () => {
    const view = addChannel(db, { type: "discord", label: "mi server", target: WEBHOOK });

    expect(view.target).toBe("https://discord.com/api/webhooks/123456789/••••");
    expect(view.target).not.toContain("tokenSuperSecreto");
    expect(view.readable).toBe(true);
  });

  it("el uso interno sí recibe el webhook completo", () => {
    addChannel(db, { type: "discord", label: "mi server", target: WEBHOOK });
    expect(listChannels(db)[0].target).toBe(WEBHOOK);
  });

  it("si cambia la clave, el canal se marca ilegible en vez de explotar", () => {
    addChannel(db, { type: "discord", label: "mi server", target: WEBHOOK });
    process.env.TEMPO_SECRET_KEY = "otra-clave";

    expect(listChannelViews(db)[0].readable).toBe(false);
    expect(listChannelViews(db)[0].target).toBe("••••");
    expect(listChannels(db)).toHaveLength(0);
  });

  it("pausa y reactiva", () => {
    const view = addChannel(db, { type: "discord", label: "mi server", target: WEBHOOK });

    expect(setChannelEnabled(db, view.id, false)).toBe(true);
    expect(listChannelViews(db)[0].enabled).toBe(false);
    expect(listChannels(db)[0].enabled).toBe(false);
  });

  it("getChannel devuelve undefined si no existe", () => {
    expect(getChannel(db, 99)).toBeUndefined();
  });

  it("elimina un canal", () => {
    const view = addChannel(db, { type: "discord", label: "mi server", target: WEBHOOK });
    expect(removeChannel(db, view.id)).toBe(true);
    expect(listChannelViews(db)).toHaveLength(0);
    expect(removeChannel(db, view.id)).toBe(false);
  });
});
