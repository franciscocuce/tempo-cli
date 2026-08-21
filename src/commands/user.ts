import { createInterface } from "node:readline/promises";
import { openDb } from "../db/connection.js";
import { hashPassword } from "../auth/password.js";
import { newUserSchema } from "../auth/schemas.js";
import { issuesToMessage } from "../store/validate.js";
import { createUser, listUsers, getUserByEmail, setPassword, removeUser, countUsers } from "../store/users.js";
import { deleteUserSessions } from "../store/sessions.js";
import { parseId } from "./parse-id.js";

interface UserAddOptions {
  email: string;
  password?: string;
}

// pedirla por stdin evita que la contraseña quede en el historial del shell
async function askPassword(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

export async function userAdd(options: UserAddOptions): Promise<void> {
  const password = options.password ?? (await askPassword("Contraseña nueva: "));

  const parsed = newUserSchema.safeParse({ email: options.email, password });
  if (!parsed.success) {
    console.error(issuesToMessage(parsed.error));
    process.exitCode = 1;
    return;
  }

  const db = openDb();
  try {
    const user = createUser(db, parsed.data.email, await hashPassword(parsed.data.password));
    console.log(`Usuario ${user.email} creado con id ${user.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message.includes("UNIQUE") ? "Ya existe un usuario con ese email" : message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

export function userList(): void {
  const db = openDb();
  try {
    const users = listUsers(db);

    if (users.length === 0) {
      console.log("No hay usuarios. Creá uno con: tempo user add --email ...");
      return;
    }

    console.table(
      users.map((user) => ({
        id: user.id,
        email: user.email,
        creado: new Date(user.createdAt).toLocaleString(),
      }))
    );
  } finally {
    db.close();
  }
}

export async function userPassword(email: string): Promise<void> {
  const password = await askPassword("Contraseña nueva: ");

  const parsed = newUserSchema.safeParse({ email, password });
  if (!parsed.success) {
    console.error(issuesToMessage(parsed.error));
    process.exitCode = 1;
    return;
  }

  const db = openDb();
  try {
    const user = getUserByEmail(db, parsed.data.email);
    if (user === undefined) {
      console.error(`No existe un usuario con el email ${email}`);
      process.exitCode = 1;
      return;
    }

    setPassword(db, user.id, await hashPassword(parsed.data.password));
    const closed = deleteUserSessions(db, user.id);
    console.log(`Contraseña de ${user.email} cambiada (${closed} sesión/es cerradas)`);
  } finally {
    db.close();
  }
}

export function userRemove(rawId: string): void {
  const id = parseId(rawId);
  if (id === undefined) {
    return;
  }

  const db = openDb();
  try {
    if (countUsers(db) === 1) {
      console.error("No podés borrar el último usuario: te quedarías afuera del dashboard");
      process.exitCode = 1;
      return;
    }

    if (removeUser(db, id)) {
      console.log(`Usuario ${id} eliminado`);
      return;
    }

    console.error(`No existe un usuario con id ${id}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
